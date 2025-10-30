import { z } from 'zod';
import { recordAuditLog } from '../lib/supabaseQueries';

export const itinerarySchema = z.object({
  title: z.union([z.string().min(1), z.null()]).optional(),
  destination: z.union([z.string().min(1), z.null()]).optional(),
  partySize: z.coerce.number().int().min(1).default(2),
  itinerary: z.array(
    z.object({
      day: z.number(),
      summary: z.string(),
      activities: z.array(
        z.object({
          title: z.string(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          description: z.string().optional(),
          city: z.string().optional(),
          poiId: z.string().optional(),
          budget: z.number().optional()
        })
      )
    })
  ),
  budget: z.object({
    total: z.number(),
    transport: z.number().optional(),
    accommodation: z.number().optional(),
    dining: z.number().optional(),
    activities: z.number().optional(),
    contingency: z.number().optional()
  })
});

export type ParsedItinerary = z.infer<typeof itinerarySchema>;

const LOCAL_API_ENDPOINT = '/api/generate-itinerary';

export async function generateItinerary(prompt: string): Promise<ParsedItinerary> {
  if (!prompt.trim()) {
    throw new Error('提示词不能为空。');
  }

  const response = await fetch(LOCAL_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt }),
    cache: 'no-store'
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('无法解析服务器响应', error);
    }
    throw new Error('解析行程生成响应失败，请稍后重试。');
  }

  if (!response.ok) {
    let errorMessage = '行程生成失败，请稍后再试。';

    if (typeof payload === 'object' && payload) {
      const maybeError = (payload as { error?: unknown }).error;
      if (typeof maybeError === 'string') {
        errorMessage = maybeError;
      }

      const rawOutput = (payload as { rawOutput?: unknown }).rawOutput;
      if (typeof rawOutput === 'string' && rawOutput.trim().length > 0) {
        errorMessage = `${errorMessage}
原始返回片段：${truncate(rawOutput)}`;
      }
    }

    throw new Error(errorMessage);
  }

  const data = typeof payload === 'object' && payload && 'data' in payload ? (payload as { data: unknown }).data : payload;
  const parsed = itinerarySchema.safeParse(data);

  if (!parsed.success) {
    throw new Error('行程解析失败，请检查 LLM 输出格式。');
  }

  const itinerary = parsed.data;

  await recordAuditLog({
    action: 'itinerary.generate',
    metadata: {
      promptLength: prompt.length,
      dayCount: itinerary.itinerary?.length ?? 0,
      totalBudget: itinerary.budget?.total ?? null
    }
  });

  return itinerary;
}

function truncate(value: string, maxLength = 800) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}
