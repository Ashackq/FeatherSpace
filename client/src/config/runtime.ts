// runtime.ts: Runtime configuration for the FeatherSpace client.
//
// Reads and normalizes all environment variables (VITE_*) and
// builds the final runtimeConfig object used across the app.
// Handles URL normalization, ICE server setup, and feature flags.

// Parse a boolean env var with a fallback default
// ParseBoolean: parse boolean.
function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

// Parse a comma-separated env var into a string array
// ParseCsv: parse csv.
function parseCsv(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Parse a numeric env var with a fallback default
// ParseNumber: parse number.
function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

// Parse ICE transport policy, only accepting "all" or "relay"
// ParseIceTransportPolicy: parse ice transport policy.
function parseIceTransportPolicy(
  value: string | undefined,
  fallback: RTCIceTransportPolicy,
): RTCIceTransportPolicy {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();
  if (normalized === "all" || normalized === "relay") {
    return normalized;
  }

  return fallback;
}

// Derive WebSocket URL from the current browser window location (used in prod without explicit env)
// DeriveWsUrlFromLocation: derive ws url from location.
function deriveWsUrlFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

// --- Read and parse all env vars ---
const wsUrlFromEnv = import.meta.env.VITE_WS_URL?.trim() ?? import.meta.env.VITE_WS_URL_PROD?.trim() ?? "";
const apiUrlFromEnv = import.meta.env.VITE_API_URL?.trim();
const stunUrlsFromEnv = parseCsv(import.meta.env.VITE_STUN_URLS);
const turnUrlsFromEnv = parseCsv(import.meta.env.VITE_TURN_URLS);
const turnUsername = import.meta.env.VITE_TURN_USERNAME?.trim() || "";
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL?.trim() || "";
const rtcIcePoolSize = parseNumber(import.meta.env.VITE_RTC_ICE_POOL_SIZE, 4);
const requestedIceTransportPolicy = parseIceTransportPolicy(
  import.meta.env.VITE_RTC_ICE_TRANSPORT_POLICY,
  "all",
);

// Normalize a WebSocket URL: upgrade ws->wss on https pages, strip trailing slash
// NormalizeWsUrl: normalize ws url.
function normalizeWsUrl(value: string): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.protocol === "https:") {
      url.protocol = "wss:";
    } else if (url.protocol === "http:") {
      url.protocol = "ws:";
    }

    const isSecurePage = typeof window !== "undefined" && window.location.protocol === "https:";

    // Browsers block ws:// from https pages. Auto-upgrade in that case.
    if (isSecurePage && url.protocol === "ws:") {
      url.protocol = "wss:";
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

// Derive REST API URL from the WebSocket URL (swap protocol)
// DeriveApiUrlFromWs: derive api url from ws.
function deriveApiUrlFromWs(value: string): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.protocol === "wss:") {
      url.protocol = "https:";
    } else if (url.protocol === "ws:") {
      url.protocol = "http:";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

// --- Build final resolved WebSocket URL ---
const resolvedWsUrl = normalizeWsUrl(
  wsUrlFromEnv || (import.meta.env.PROD ? deriveWsUrlFromLocation() : ""),
);

// --- Build ICE server list from env vars (STUN + optional TURN) ---
const defaultStunUrls = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

const rtcIceServers: RTCIceServer[] = [];

const stunUrls = stunUrlsFromEnv.length > 0 ? stunUrlsFromEnv : defaultStunUrls;
if (stunUrls.length > 0) {
  rtcIceServers.push({ urls: stunUrls });
}

if (turnUrlsFromEnv.length > 0) {
  const turnServer: RTCIceServer = {
    urls: turnUrlsFromEnv,
  };

  if (turnUsername) {
    turnServer.username = turnUsername;
  }

  if (turnCredential) {
    turnServer.credential = turnCredential;
  }

  rtcIceServers.push(turnServer);
}

// If relay-only policy is requested but no TURN servers are configured, fall back to "all"
const hasTurnServers = turnUrlsFromEnv.length > 0;
const rtcIceTransportPolicy: RTCIceTransportPolicy =
  requestedIceTransportPolicy === "relay" && !hasTurnServers ? "all" : requestedIceTransportPolicy;

// Final exported config object consumed by hooks and pages throughout the app
export const runtimeConfig = {
  appEnv: import.meta.env.VITE_APP_ENV?.trim() || "development",
  wsUrl: resolvedWsUrl,
  apiUrl: apiUrlFromEnv || deriveApiUrlFromWs(resolvedWsUrl),
  enableRealtime: parseBoolean(import.meta.env.VITE_ENABLE_REALTIME, Boolean(resolvedWsUrl)),
  rtcIceServers,
  rtcHasTurnServers: hasTurnServers,
  rtcIceTransportPolicy,
  rtcIceCandidatePoolSize: Math.max(0, Math.min(64, Math.floor(rtcIcePoolSize))),
};
