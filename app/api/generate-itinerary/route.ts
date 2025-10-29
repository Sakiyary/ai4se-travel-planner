import { NextResponse } from 'next/server';
import { itinerarySchema } from '../../../services/llm';

const DASHSCOPE_ENDPOINT =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

interface RequestBody {
  prompt?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
      return NextResponse.json({ error: '请求缺少有效的提示词内容。' }, { status: 400 });
    }

    const apiKey = process.env.DASHSCOPE_API_KEY ?? process.env.NEXT_PUBLIC_DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '服务器未配置 DashScope API Key。' }, { status: 500 });
    }

    const MAX_ATTEMPTS = 5;
    let lastFormatError: {
      error: string;
      rawOutput?: string;
      details?: unknown;
    } | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const dashResponse = await fetch(DASHSCOPE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          input: { prompt },
          parameters: {
            result_format: 'json',
            max_output_tokens: 1024
          }
        }),
        cache: 'no-store'
      });

      if (!dashResponse.ok) {
        let errorPayload: unknown;
        try {
          errorPayload = await dashResponse.json();
        } catch {
          errorPayload = await dashResponse.text();
        }

        return NextResponse.json(
          {
            error: 'DashScope 请求失败，请稍后重试。',
            details: errorPayload
          },
          { status: dashResponse.status }
        );
      }

      const dashJson = await dashResponse.json();
      const rawOutput =
        dashJson?.output?.text ?? dashJson?.output?.choices?.[0]?.message?.content ?? null;

      if (!rawOutput) {
        lastFormatError = { error: 'DashScope 响应为空，请检查提示词与模型配置。' };
        if (attempt === MAX_ATTEMPTS) {
          break;
        }
        continue;
      }

      let structuredPayload: unknown;
      if (typeof rawOutput === 'string') {
        try {
          structuredPayload = JSON.parse(rawOutput);
        } catch {
          lastFormatError = {
            error: 'DashScope 输出不是有效的 JSON 字符串。',
            rawOutput: truncateForLogging(rawOutput)
          };
          if (attempt === MAX_ATTEMPTS) {
            break;
          }
          continue;
        }
      } else {
        structuredPayload = rawOutput;
      }

      const parsed = itinerarySchema.safeParse(structuredPayload);
      if (!parsed.success) {
        lastFormatError = {
          error: 'LLM 返回格式不符合预期，请调整提示词后重试。',
          details: parsed.error.flatten(),
          rawOutput: typeof rawOutput === 'string' ? truncateForLogging(rawOutput) : undefined
        };
        if (attempt === MAX_ATTEMPTS) {
          break;
        }
        continue;
      }

      return NextResponse.json({ data: parsed.data }, { status: 200 });
    }

    return NextResponse.json(
      {
        error: `LLM 在 ${MAX_ATTEMPTS} 次尝试后仍未返回符合预期的行程数据。`,
        lastError: lastFormatError ?? undefined
      },
      { status: 502 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成行程接口出现未知错误。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function truncateForLogging(value: string, maxLength = 2000) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}
