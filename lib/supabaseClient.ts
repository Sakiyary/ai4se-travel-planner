import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeConfig } from './runtimeConfig';

let cachedClient: SupabaseClient | undefined;

function resolveSupabaseCredentials() {
  const config = getRuntimeConfig();
  const supabaseUrl = config.supabaseUrl;
  const supabaseAnonKey = config.supabaseAnonKey;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[supabaseClient] Supabase 环境变量未配置完整，将在调用时抛出异常。');
  }

  return { supabaseUrl, supabaseAnonKey } as const;
}

export function getSupabaseClient(): SupabaseClient | undefined {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseCredentials();

  if (!supabaseUrl || !supabaseAnonKey) {
    return undefined;
  }

  if (typeof window === 'undefined') {
    // 服务端每次调用都返回新的实例，以避免跨请求共享状态。
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return cachedClient;
}
