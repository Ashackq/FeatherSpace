// env.d.ts: Vite environment variable type declarations.
//
// Augments ImportMetaEnv with all VITE_ prefixed variables used in this project.
// Values are read at build/runtime from .env files or deployment config.

/// <reference types="vite/client" />

interface ImportMetaEnv {
  // WebSocket backend URL (dev vs prod variants)
  readonly VITE_WS_URL?: string;
  readonly VITE_WS_URL_PROD?: string;
  // REST API URL (auto-derived from WS URL if omitted)
  readonly VITE_API_URL?: string;
  // Enable/disable real-time sync
  readonly VITE_ENABLE_REALTIME?: string;
  // App environment label (development, staging, production)
  readonly VITE_APP_ENV?: string;
  // Comma-separated STUN server URLs
  readonly VITE_STUN_URLS?: string;
  // Comma-separated TURN server URLs
  readonly VITE_TURN_URLS?: string;
  // TURN credentials
  readonly VITE_TURN_USERNAME?: string;
  readonly VITE_TURN_CREDENTIAL?: string;
  // ICE transport policy: "all" or "relay"
  readonly VITE_RTC_ICE_TRANSPORT_POLICY?: string;
  // ICE candidate pool size for RTCPeerConnection
  readonly VITE_RTC_ICE_POOL_SIZE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
