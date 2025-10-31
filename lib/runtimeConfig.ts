export interface RuntimeConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseExportBucket?: string;
  supabaseVoiceBucket?: string;
  amapWebKey?: string;
  amapSecurityJsCode?: string;
  iflytekAppId?: string;
  iflytekApiKey?: string;
  iflytekApiSecret?: string;
  dashscopeApiKey?: string;
}

const serverRuntimeConfig: RuntimeConfig = {
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseExportBucket:
    process.env.SUPABASE_EXPORT_BUCKET ?? process.env.NEXT_PUBLIC_SUPABASE_EXPORT_BUCKET,
  supabaseVoiceBucket:
    process.env.SUPABASE_VOICE_BUCKET ?? process.env.NEXT_PUBLIC_SUPABASE_VOICE_BUCKET,
  amapWebKey: process.env.AMAP_WEB_KEY ?? process.env.NEXT_PUBLIC_AMAP_KEY,
  amapSecurityJsCode:
    process.env.AMAP_SECURITY_JS_CODE ?? process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE,
  iflytekAppId: process.env.IFLYTEK_APP_ID ?? process.env.NEXT_PUBLIC_IFLYTEK_APP_ID,
  iflytekApiKey: process.env.IFLYTEK_API_KEY ?? process.env.NEXT_PUBLIC_IFLYTEK_API_KEY,
  iflytekApiSecret:
    process.env.IFLYTEK_API_SECRET ?? process.env.NEXT_PUBLIC_IFLYTEK_API_SECRET,
  dashscopeApiKey: process.env.DASHSCOPE_API_KEY ?? process.env.NEXT_PUBLIC_DASHSCOPE_API_KEY
};

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window !== 'undefined') {
    return window.__APP_CONFIG__ ?? {};
  }

  return serverRuntimeConfig;
}

export function getConfigValue<K extends keyof RuntimeConfig>(
  key: K,
  fallback?: NonNullable<RuntimeConfig[K]>
): RuntimeConfig[K] | undefined {
  const config = getRuntimeConfig();
  return config[key] ?? fallback;
}
