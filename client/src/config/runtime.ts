function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function keepNonTurnUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    const normalized = url.trim().toLowerCase();
    return !(normalized.startsWith("turn:") || normalized.startsWith("turns:"));
  });
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

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
const rtcIcePoolSize = parseNumber(import.meta.env.VITE_RTC_ICE_POOL_SIZE, 4);

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

const stunUrls = keepNonTurnUrls(stunUrlsFromEnv.length > 0 ? stunUrlsFromEnv : defaultStunUrls);
if (stunUrls.length > 0) {
  rtcIceServers.push({ urls: stunUrls });
}

export const runtimeConfig = {
  appEnv: import.meta.env.VITE_APP_ENV?.trim() || "development",
  wsUrl: resolvedWsUrl,
  apiUrl: apiUrlFromEnv || deriveApiUrlFromWs(resolvedWsUrl),
  enableRealtime: parseBoolean(import.meta.env.VITE_ENABLE_REALTIME, Boolean(resolvedWsUrl)),
  rtcIceServers,
  rtcHasTurnServers: false,
  rtcIceTransportPolicy: "all" as RTCIceTransportPolicy,
  rtcIceCandidatePoolSize: Math.max(0, Math.min(64, Math.floor(rtcIcePoolSize))),
};
