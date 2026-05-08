// ParseBoolean: parse boolean.
function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

// ParseCsv: parse csv.
function parseCsv(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// ParseNumber: parse number.
function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

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

// DeriveWsUrlFromLocation: derive ws url from location.
function deriveWsUrlFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

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

const resolvedWsUrl = normalizeWsUrl(
  wsUrlFromEnv || (import.meta.env.PROD ? deriveWsUrlFromLocation() : ""),
);

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

const hasTurnServers = turnUrlsFromEnv.length > 0;
const rtcIceTransportPolicy: RTCIceTransportPolicy =
  requestedIceTransportPolicy === "relay" && !hasTurnServers ? "all" : requestedIceTransportPolicy;

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
