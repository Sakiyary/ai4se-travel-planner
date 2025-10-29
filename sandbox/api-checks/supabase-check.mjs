import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const table = process.env.SUPABASE_HEALTH_TABLE || 'profiles';

if (!url || !anonKey) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY，请在 .env 中配置。');
  process.exitCode = 1;
  process.exit();
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false }
});

try {
  const { data, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: false })
    .limit(1);

  if (error) {
    console.error('Supabase 查询失败：', error.message);
    process.exitCode = 1;
  } else {
    console.log(`Supabase API 正常，表 "${table}" 返回 ${data?.length ?? 0} 行。`);
  }
} catch (err) {
  console.error('Supabase 请求异常：', err);
  process.exitCode = 1;
}
