const MIN_TOKEN_LENGTH = 32;
const DEFAULT_IDLE_S = 180;
const DEFAULT_KEEPALIVE_S = 30;

export function terminalToken(env = process.env) {
  const raw = (env.TERMINAL_TOKEN ?? "").trim().replace(/^"(.*)"$/, "$1");
  return raw.length >= MIN_TOKEN_LENGTH ? raw : null;
}

export function idleConfig(env = process.env) {
  const seconds = (raw, fallback, { allowZero = false } = {}) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || (n === 0 && !allowZero)) return fallback;
    return n;
  };
  return {
    idleMs: seconds(env.IDLE_SECONDS, DEFAULT_IDLE_S) * 1000,
    keepaliveMs: seconds(env.KEEPALIVE_SECONDS, DEFAULT_KEEPALIVE_S, { allowZero: true }) * 1000,
  };
}
