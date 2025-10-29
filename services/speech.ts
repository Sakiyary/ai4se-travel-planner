export interface SpeechToTextResult {
  text: string;
  confidence?: number;
}

export async function transcribeAudio(blob: Blob): Promise<SpeechToTextResult> {
  if (typeof window === 'undefined' || typeof window.WebSocket === 'undefined') {
    throw new Error('科大讯飞语音转写仅在浏览器环境中可用。');
  }

  const appId = process.env.NEXT_PUBLIC_IFLYTEK_APP_ID ?? process.env.IFLYTEK_APP_ID;
  const apiKey = process.env.NEXT_PUBLIC_IFLYTEK_API_KEY ?? process.env.IFLYTEK_API_KEY;
  const apiSecret = process.env.NEXT_PUBLIC_IFLYTEK_API_SECRET ?? process.env.IFLYTEK_API_SECRET;

  if (!appId || !apiKey || !apiSecret) {
    throw new Error('缺少科大讯飞凭据，请配置 IFLYTEK_APP_ID / IFLYTEK_API_KEY / IFLYTEK_API_SECRET。');
  }

  const audioBuffer = await blob.arrayBuffer();
  if (audioBuffer.byteLength === 0) {
    throw new Error('音频数据为空，无法进行语音转写。');
  }

  const audioBytes = new Uint8Array(audioBuffer);
  const frames: string[] = [];
  const frameSize = 1280;

  for (let offset = 0; offset < audioBytes.length; offset += frameSize) {
    frames.push(uint8ToBase64(audioBytes.subarray(offset, offset + frameSize)));
  }

  const { url } = await createIatSignedUrl(apiKey, apiSecret);

  return new Promise<SpeechToTextResult>((resolve, reject) => {
    let frameIndex = 0;
    let timer: number | undefined;
    let closed = false;
    const transcriptFragments: string[] = [];

    const ws = new WebSocket(url);

    function cleanup() {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }

    function rejectOnce(error: Error) {
      if (!closed) {
        closed = true;
        cleanup();
        reject(error);
      }
    }

    function resolveOnce(result: SpeechToTextResult) {
      if (!closed) {
        closed = true;
        cleanup();
        resolve(result);
      }
    }

    function sendFrame(status: 0 | 1 | 2) {
      const payload: Record<string, unknown> = {
        data: {
          status,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: status === 2 ? '' : frames[frameIndex] ?? ''
        }
      };

      if (status === 0) {
        payload.common = { app_id: appId };
        payload.business = {
          language: 'zh_cn',
          domain: 'iat',
          accent: 'mandarin',
          vinfo: 1,
          dwa: 'wpgs'
        };
      }

      ws.send(JSON.stringify(payload));
    }

    ws.onopen = () => {
      sendFrame(0);

      timer = window.setInterval(() => {
        frameIndex += 1;
        if (frameIndex >= frames.length) {
          sendFrame(2);
          if (timer !== undefined) {
            window.clearInterval(timer);
            timer = undefined;
          }
        } else {
          sendFrame(1);
        }
      }, 40);
    };

    ws.onerror = () => {
      rejectOnce(new Error('科大讯飞 WebSocket 连接错误。'));
    };

    ws.onclose = () => {
      if (!closed) {
        rejectOnce(new Error('科大讯飞 WebSocket 已关闭，未获得完整结果。'));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);

        if (message.code !== 0) {
          rejectOnce(new Error(`科大讯飞返回错误：${message.code} ${message.message ?? ''}`));
          return;
        }

        const segments = message.data?.result?.ws ?? [];
        if (segments.length > 0) {
          const partialText = extractTextFromSegments(segments);
          if (partialText) {
            transcriptFragments.push(partialText);
          }
        }

        if (message.data?.status === 2) {
          const finalSegments = message.data?.result?.ws ?? [];
          const finalText = finalSegments.length > 0 ? extractTextFromSegments(finalSegments) : '';

          resolveOnce({ text: finalText || transcriptFragments.join('') });
        }
      } catch (error) {
        rejectOnce(error instanceof Error ? error : new Error('解析科大讯飞响应失败。'));
      }
    };
  });
}

async function createIatSignedUrl(apiKey: string, apiSecret: string) {
  const host = 'iat-api.xfyun.cn';
  const requestLine = 'GET /v2/iat HTTP/1.1';
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;
  const signatureSha = await hmacSha256Base64(apiSecret, signatureOrigin);
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = btoa(authorizationOrigin);

  const url = `wss://${host}/v2/iat?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;

  return { url };
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return arrayBufferToBase64(signature);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }

  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function extractTextFromSegments(segments: Array<{ cw?: Array<{ w?: string }> }>): string {
  return segments
    .map((segment) =>
      (segment.cw ?? [])
        .map((word) => (typeof word.w === 'string' ? word.w : ''))
        .join('')
    )
    .join('');
}
