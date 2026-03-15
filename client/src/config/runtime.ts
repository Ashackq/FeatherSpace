function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

const wsUrl = import.meta.env.VITE_WS_URL?.trim() ?? "";

export const runtimeConfig = {
  appEnv: import.meta.env.VITE_APP_ENV?.trim() || "development",
  wsUrl,
  enableRealtime: parseBoolean(import.meta.env.VITE_ENABLE_REALTIME, Boolean(wsUrl)),
};
