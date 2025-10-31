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

function readEnv(key: string): string | undefined {
  return process.env[key];
}

function resolveEnv(primary: string, fallback?: string): string | undefined {
  const value = readEnv(primary);
  if (value !== undefined && value !== '') {
    return value;
  }
  return fallback ? readEnv(fallback) : undefined;
}

export function getServerRuntimeConfig(): RuntimeConfig {
  return {
    supabaseUrl: resolveEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: resolveEnv('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    supabaseExportBucket: resolveEnv('SUPABASE_EXPORT_BUCKET', 'NEXT_PUBLIC_SUPABASE_EXPORT_BUCKET'),
    supabaseVoiceBucket: resolveEnv('SUPABASE_VOICE_BUCKET', 'NEXT_PUBLIC_SUPABASE_VOICE_BUCKET'),
    amapWebKey: resolveEnv('AMAP_WEB_KEY', 'NEXT_PUBLIC_AMAP_KEY'),
    amapSecurityJsCode: resolveEnv('AMAP_SECURITY_JS_CODE', 'NEXT_PUBLIC_AMAP_SECURITY_JS_CODE'),
    iflytekAppId: resolveEnv('IFLYTEK_APP_ID', 'NEXT_PUBLIC_IFLYTEK_APP_ID'),
    iflytekApiKey: resolveEnv('IFLYTEK_API_KEY', 'NEXT_PUBLIC_IFLYTEK_API_KEY'),
    iflytekApiSecret: resolveEnv('IFLYTEK_API_SECRET', 'NEXT_PUBLIC_IFLYTEK_API_SECRET'),
    dashscopeApiKey: resolveEnv('DASHSCOPE_API_KEY', 'NEXT_PUBLIC_DASHSCOPE_API_KEY')
  } satisfies RuntimeConfig;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window !== 'undefined') {
    return window.__APP_CONFIG__ ?? {};
  }

  return getServerRuntimeConfig();
}

export function getConfigValue<K extends keyof RuntimeConfig>(
  key: K,
  fallback?: NonNullable<RuntimeConfig[K]>
): RuntimeConfig[K] | undefined {
  const config = getRuntimeConfig();
  return config[key] ?? fallback;
}
