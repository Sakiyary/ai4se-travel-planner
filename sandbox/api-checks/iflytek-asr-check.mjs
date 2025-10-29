import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import process from 'process';
import WebSocket from 'ws';

const appId = process.env.IFLYTEK_APP_ID;
const apiKey = process.env.IFLYTEK_API_KEY;
const apiSecret = process.env.IFLYTEK_API_SECRET;
const audioPath = process.env.IFLYTEK_AUDIO_PATH;

if (!appId || !apiKey || !apiSecret) {
  console.error('请在 .env 中配置 IFLYTEK_APP_ID / IFLYTEK_API_KEY / IFLYTEK_API_SECRET。');
  process.exitCode = 1;
  process.exit();
}

if (!audioPath) {
  console.error('请在 .env 中配置 IFLYTEK_AUDIO_PATH，指向待识别的 PCM 音频文件。');
  process.exitCode = 1;
  process.exit();
}

const resolvedAudioPath = path.resolve(audioPath);

if (!fs.existsSync(resolvedAudioPath)) {
  console.error(`音频文件不存在：${resolvedAudioPath}`);
  process.exitCode = 1;
  process.exit();
}

const audioBuffer = fs.readFileSync(resolvedAudioPath);
if (audioBuffer.length === 0) {
  console.error('音频文件为空，请提供有效的 PCM 数据。');
  process.exitCode = 1;
  process.exit();
}

const HOST = 'iat-api.xfyun.cn';
const REQUEST_LINE = 'GET /v2/iat HTTP/1.1';

const date = new Date().toUTCString();
const signatureOrigin = `host: ${HOST}\ndate: ${date}\n${REQUEST_LINE}`;
const signatureSha = crypto
  .createHmac('sha256', apiSecret)
  .update(signatureOrigin)
  .digest('base64');
const authorizationOrigin = `api_key=\"${apiKey}\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"${signatureSha}\"`;
const authorization = Buffer.from(authorizationOrigin).toString('base64');
const wsUrl = `wss://${HOST}/v2/iat?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(HOST)}`;

const FRAME_SIZE = 1280;
const frames = [];
for (let offset = 0; offset < audioBuffer.length; offset += FRAME_SIZE) {
  frames.push(audioBuffer.subarray(offset, offset + FRAME_SIZE));
}

console.log('正在连接科大讯飞语音听写服务...');

const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });
let resultText = '';
let frameIndex = 0;
let closed = false;

function sendFrame(status) {
  const audioChunk = status === 2 ? '' : frames[frameIndex]?.toString('base64') ?? '';
  const payload = {
    data: {
      status,
      format: 'audio/L16;rate=16000',
      encoding: 'raw',
      audio: audioChunk
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

ws.on('open', () => {
  console.log('连接成功，开始发送音频数据...');
  sendFrame(0);

  const interval = setInterval(() => {
    frameIndex += 1;
    if (frameIndex >= frames.length) {
      clearInterval(interval);
      sendFrame(2);
    } else {
      sendFrame(1);
    }
  }, 40);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    if (message.code !== 0) {
      console.error('识别失败：', message.code, message.message);
      ws.close();
      process.exitCode = 1;
      return;
    }

    const segments = message.data?.result?.ws ?? [];
    for (const seg of segments) {
      const words = seg.cw ?? [];
      for (const item of words) {
        resultText += item.w ?? '';
      }
    }

    if (message.data?.status === 2 && !closed) {
      closed = true;
      console.log('识别完成：');
      console.log(resultText || '(未识别出文本)');
      ws.close();
    }
  } catch (err) {
    console.error('解析响应时出错：', err);
    process.exitCode = 1;
  }
});

ws.on('error', (err) => {
  console.error('WebSocket 出错：', err.message);
  process.exitCode = 1;
});

ws.on('close', () => {
  if (!closed && resultText === '') {
    console.warn('连接已关闭，未获取到识别结果。');
  }
});
