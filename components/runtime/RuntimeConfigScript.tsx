/* eslint-disable @next/next/no-before-interactive-script-outside-document */
import Script from 'next/script';
import { getRuntimeConfig } from '../../lib/runtimeConfig';

function serializeConfig(config: unknown) {
  return JSON.stringify(config).replace(/</g, '\\u003c');
}

export function RuntimeConfigScript() {
  const config = getRuntimeConfig();
  const serialized = serializeConfig(config);

  return (
    <Script
      id="runtime-config"
      strategy="beforeInteractive"
      // 将运行时配置注入到全局，供客户端组件读取。
      dangerouslySetInnerHTML={{
        __html: `window.__APP_CONFIG__ = Object.assign({}, window.__APP_CONFIG__, ${serialized});`
      }}
    />
  );
}
