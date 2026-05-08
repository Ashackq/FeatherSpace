/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  readonly VITE_WS_URL_PROD?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_REALTIME?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_STUN_URLS?: string;
  readonly VITE_RTC_ICE_POOL_SIZE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
