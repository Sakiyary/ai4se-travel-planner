const publicEnvFallback = {
  NEXT_PUBLIC_SUPABASE_URL: 'SUPABASE_URL',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY',
  NEXT_PUBLIC_SUPABASE_EXPORT_BUCKET: 'SUPABASE_EXPORT_BUCKET',
  NEXT_PUBLIC_SUPABASE_VOICE_BUCKET: 'SUPABASE_VOICE_BUCKET',
  NEXT_PUBLIC_IFLYTEK_APP_ID: 'IFLYTEK_APP_ID',
  NEXT_PUBLIC_IFLYTEK_API_KEY: 'IFLYTEK_API_KEY',
  NEXT_PUBLIC_IFLYTEK_API_SECRET: 'IFLYTEK_API_SECRET',
  NEXT_PUBLIC_AMAP_KEY: 'AMAP_WEB_KEY',
  NEXT_PUBLIC_DASHSCOPE_API_KEY: 'DASHSCOPE_API_KEY'
};

for (const [publicKey, baseKey] of Object.entries(publicEnvFallback)) {
  if (!process.env[publicKey] && process.env[baseKey]) {
    process.env[publicKey] = process.env[baseKey];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    optimisticClientCache: true
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  }
};

export default nextConfig;
