function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

const wsUrl = import.meta.env.VITE_WS_URL?.trim() ?? "";
const apiUrlFromEnv = import.meta.env.VITE_API_URL?.trim();

function normalizeWsUrl(value: string): string {
  if (!value) return "";

  try {
    const url = new URL(value);
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

const resolvedWsUrl = normalizeWsUrl(wsUrl);

export const runtimeConfig = {
  appEnv: import.meta.env.VITE_APP_ENV?.trim() || "development",
  wsUrl: resolvedWsUrl,
  apiUrl: apiUrlFromEnv || deriveApiUrlFromWs(resolvedWsUrl),
  enableRealtime: parseBoolean(import.meta.env.VITE_ENABLE_REALTIME, Boolean(resolvedWsUrl)),
};
