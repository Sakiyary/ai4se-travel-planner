import type { RuntimeConfig } from '../lib/runtimeConfig';

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig;
  }
}

export { };
