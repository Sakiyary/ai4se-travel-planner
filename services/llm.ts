import axios from 'axios';
import { z } from 'zod';

const itinerarySchema = z.object({
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

const DASHSCOPE_ENDPOINT =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export async function generateItinerary(prompt: string): Promise<ParsedItinerary> {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.NEXT_PUBLIC_DASHSCOPE_API_KEY;

  if (!apiKey) {
    throw new Error('缺少 DashScope API Key，请在环境变量中配置 DASHSCOPE_API_KEY。');
  }

  const response = await axios.post(
    DASHSCOPE_ENDPOINT,
    {
      model: 'qwen-plus',
      input: {
        prompt
      },
      parameters: {
        result_format: 'json',
        max_output_tokens: 1024
      }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      timeout: 20_000
    }
  );

  const rawOutput =
    response.data?.output?.text ?? response.data?.output?.choices?.[0]?.message?.content;

  if (!rawOutput) {
    throw new Error('DashScope 响应为空，请检查模型配置或请求体。');
  }

  let parsedPayload: unknown;

  if (typeof rawOutput === 'string') {
    try {
      parsedPayload = JSON.parse(rawOutput);
    } catch {
      throw new Error('DashScope 输出不是有效的 JSON 字符串，请检查提示词与 result_format。');
    }
  } else {
    parsedPayload = rawOutput;
  }

  const parsed = itinerarySchema.safeParse(parsedPayload);
  if (!parsed.success) {
    throw new Error('行程解析失败，请检查 LLM 输出格式。');
  }

  return parsed.data;
}
