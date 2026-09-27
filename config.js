const MIN_TOKEN_LENGTH = 32;

export function terminalToken(env = process.env) {
  const raw = (env.TERMINAL_TOKEN ?? "").trim().replace(/^"(.*)"$/, "$1");
  return raw.length >= MIN_TOKEN_LENGTH ? raw : null;
}
