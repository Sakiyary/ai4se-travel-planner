import 'dotenv/config';
import axios from 'axios';

const amapKey = process.env.AMAP_WEB_KEY;

if (!amapKey) {
  console.error('缺少 AMAP_WEB_KEY，请在 .env 中配置。');
  process.exitCode = 1;
  process.exit();
}

try {
  const response = await axios.get('https://restapi.amap.com/v3/place/text', {
    params: {
      key: amapKey,
      keywords: '咖啡',
      city: '310000',
      page: 1,
      offset: 3
    },
    timeout: 10_000
  });

  if (response.data?.status === '1') {
    const pois = response.data.pois ?? [];
    if (pois.length === 0) {
      console.warn('高德 API 调用成功，但未返回 POI。请确认 Key 权限。');
    } else {
      console.log('高德 API 调用成功，示例地点：');
      for (const poi of pois) {
        console.log(`- ${poi.name} | ${poi.address || '暂无地址'} (${poi.adname ?? ''})`);
      }
    }
  } else {
    console.error('高德 API 返回错误：', response.data?.infocode, response.data?.info);
    process.exitCode = 1;
  }
} catch (error) {
  if (error.response) {
    console.error('高德 API 调用失败：', error.response.status, error.response.data);
  } else {
    console.error('高德 请求异常：', error.message);
  }
  process.exitCode = 1;
}
