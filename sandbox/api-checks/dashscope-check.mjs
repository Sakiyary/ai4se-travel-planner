import 'dotenv/config';
import axios from 'axios';

const apiKey = process.env.DASHSCOPE_API_KEY;

if (!apiKey) {
  console.error('缺少 DASHSCOPE_API_KEY，请在 .env 中配置。');
  process.exitCode = 1;
  process.exit();
}

try {
  const response = await axios.post(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    {
      model: 'qwen-plus',
      input: {
        prompt: '请用一句话描述一个对亲子友好的东京一日游亮点。'
      },
      parameters: {
        result_format: 'message',
        max_output_tokens: 200
      }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      timeout: 15_000
    }
  );

  const content = response.data?.output?.text || response.data?.output?.choices?.[0]?.message?.content;

  if (content) {
    console.log('DashScope 调用成功，示例输出：');
    console.log(content);
  } else {
    console.warn('DashScope 响应成功，但未解析到文本。完整响应：');
    console.dir(response.data, { depth: null });
  }
} catch (error) {
  if (error.response) {
    console.error('DashScope 调用失败：', error.response.status, error.response.data);
  } else {
    console.error('DashScope 请求异常：', error.message);
  }
  process.exitCode = 1;
}
