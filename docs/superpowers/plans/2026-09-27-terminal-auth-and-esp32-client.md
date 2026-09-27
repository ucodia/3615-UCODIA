# Terminal Authentication, Single Configuration and ESP32 Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only the gallery terminal can use the server webcam, the playground is local-only, one `.env` configures server, install script and ESP32, and the ESP32 client is built from this repository with arduino-cli.

**Architecture:** The ESP32 presents a shared token as the websocket subprotocol; `startServer` selects it with `handleProtocols` and passes a `terminal` flag to the page handler, which hides the photobooth from public connections. A middleware answers 404 to tunnel requests (those carrying `cf-connecting-ip`) for the playground, `/lib` and `/api/vdt`. A node script turns `.env` into a generated `config.h` for the sketch.

**Tech Stack:** Node 22 ESM, `ws` 8, express 4, `node --test`; arduino-cli with the `esp32:esp32` core, `WebSockets` (Links2004) and `Minitel1B_Hard` libraries.

**Spec:** `docs/superpowers/specs/2026-09-27-terminal-auth-and-esp32-client-design.md`

## Global Constraints

- Node 22.9 or later for `--env-file-if-exists` (Pi: 22.23, Mac: 22.14).
- `.env` and `esp32/client/config.h` are never committed. No task writes a real secret into a tracked file, a test fixture, a commit message or this plan.
- `TERMINAL_TOKEN` shorter than 32 characters counts as unset.
- Token comparison uses `crypto.timingSafeEqual`; unequal lengths are a mismatch.
- The photobooth page function is never constructed for a public connection.
- Sketch behaviour other than configuration is unchanged from `Minitel1B_Websocket_Client.ino`.
- The install script must not prompt; it fails without `.env` or `PUBLIC_URL`.
- Commits: concise, precise, no co-author, no AI mention, no links.
- Tests run with `npm test`; the suite is 185 passing at the start.

## Review Focus

1. `TERMINAL_TOKEN` in `.env` with surrounding whitespace or quotes, or `.env` with CRLF line endings: the server and the generator must agree on the exact token, so both trim and strip quotes (Task 1 tests the server side, Task 5 the generator).
2. A browser or library that offers an unrelated subprotocol such as `binary` or `json`: still a public connection, no crash, no log at error level (Task 2).
3. A client offering several protocols including the token, `other, <token>`: still a terminal (Task 2).
4. `PUBLIC_URL` with a trailing slash, a path or an explicit port: the generator derives host, port and TLS correctly and the server strips the slash (Task 5, existing config test).
5. A request through a non-Cloudflare proxy carrying `x-forwarded-for` but not `cf-connecting-ip`: treated as local by design; the README says the playground restriction assumes the Cloudflare tunnel is the only public path (Task 4 documents, Task 7 README).

---

### Task 1: Token config, `.env.example`, ignore rules and start scripts

**Files:**
- Create: `config.js`
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `package.json` (scripts)
- Test: `test/config.test.js`

**Interfaces:**
- Produces: `terminalToken(env = process.env) -> string | null` in `config.js`. Returns the trimmed, unquoted `TERMINAL_TOKEN` when it is at least 32 characters, else `null`.

- [ ] **Step 1: Write the failing test**

```js
// test/config.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { terminalToken } from "../config.js";

const TOKEN = "a".repeat(64);

test("terminalToken returns the token when it is long enough", () => {
  assert.equal(terminalToken({ TERMINAL_TOKEN: TOKEN }), TOKEN);
});

test("terminalToken trims whitespace, a carriage return and surrounding double quotes", () => {
  assert.equal(terminalToken({ TERMINAL_TOKEN: ` "${TOKEN}"\r` }), TOKEN);
});

test("terminalToken is null when unset, empty or shorter than 32 characters", () => {
  assert.equal(terminalToken({}), null);
  assert.equal(terminalToken({ TERMINAL_TOKEN: "" }), null);
  assert.equal(terminalToken({ TERMINAL_TOKEN: "x".repeat(31) }), null);
  assert.equal(terminalToken({ TERMINAL_TOKEN: "x".repeat(32) }), "x".repeat(32));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/config.test.js`
Expected: FAIL, `Cannot find module '.../config.js'`

- [ ] **Step 3: Write the minimal implementation**

```js
// config.js
const MIN_TOKEN_LENGTH = 32;

export function terminalToken(env = process.env) {
  const raw = (env.TERMINAL_TOKEN ?? "").trim().replace(/^"(.*)"$/, "$1");
  return raw.length >= MIN_TOKEN_LENGTH ? raw : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/config.test.js`
Expected: PASS, 3 tests

- [ ] **Step 5: Add `.env.example`**

```
# Copy to .env and fill in. .env is ignored by git and read by:
#   - the server (npm start / npm run dev / the systemd unit) through node --env-file-if-exists
#   - install.sh, which checks PUBLIC_URL and TERMINAL_TOKEN before writing the service unit
#   - bin/esp32-config.js, which writes esp32/client/config.h for the ESP32 firmware

# Public base URL of the server. The ESP32 connects to its host: https means wss on 443,
# http means ws on the URL's port (3615 when absent), e.g. http://minitelpi:3615 for a LAN test.
PUBLIC_URL=https://slice.example.com

# Shared secret presented by the ESP32 as the websocket subprotocol. Connections presenting it
# are the gallery terminal and get the photobooth. At least 32 characters: openssl rand -hex 32
TERMINAL_TOKEN=replace-me-with-64-hex-characters-from-openssl-rand-hex-32

# Wi-Fi networks the ESP32 tries in order. Numbering starts at 1 and stops at the first missing SSID.
WIFI_SSID_1=gallery-wifi
WIFI_PASSWORD_1=gallery-wifi-password
WIFI_SSID_2=backup-wifi
WIFI_PASSWORD_2=backup-wifi-password

# Photobooth, optional. Defaults: 0 (macOS) or /dev/video0, the ffmpeg-static binary, 300 seconds.
#PHOTOBOOTH_DEVICE=/dev/video0
#PHOTOBOOTH_FFMPEG=/usr/bin/ffmpeg
#PHOTOBOOTH_TTL=300
```

- [ ] **Step 6: Ignore `.env` and the generated header**

Append to `.gitignore`, keeping a trailing newline:

```
.env
esp32/client/config.h
```

Run: `tail -c1 .gitignore | xxd | grep -c 0a`
Expected: `1`

- [ ] **Step 7: Start scripts load `.env`**

In `package.json` replace the `start` and `dev` scripts:

```json
"start": "node --env-file-if-exists=.env index.js",
"dev": "nodemon --exec \"node --env-file-if-exists=.env\" index.js",
```

Run: `npm start & sleep 3; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3615/; kill %1`
Expected: `200` (the server still starts without a `.env`; stop it afterwards, port 3615 must be free for the user's dev server)

- [ ] **Step 8: Run the whole suite**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 188`, `# fail 0`

- [ ] **Step 9: Commit**

```bash
git add config.js test/config.test.js .env.example .gitignore package.json
git commit -m "Add .env configuration: TERMINAL_TOKEN reader, example file, start scripts loading .env"
```

---

### Task 2: Terminal detection in the websocket handshake

**Files:**
- Modify: `server.js`
- Test: `test/server-auth.test.js`

**Interfaces:**
- Consumes: `terminalToken` from Task 1 (only in `index.js`, Task 3; the server takes the token as an option).
- Produces: `selectProtocol(token) -> (protocols: Set<string>) => string | false` exported from `server.js`; `startServer(serviceHandler, port, { photoStore, sweepMs, terminalToken })`; the handler is called as `serviceHandler(ws, req, { terminal })`.

- [ ] **Step 1: Write the failing tests**

```js
// test/server-auth.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import WebSocket from "ws";
import { selectProtocol, startServer } from "../server.js";

const TOKEN = "f".repeat(64);

test("selectProtocol picks the token and nothing else", () => {
  const select = selectProtocol(TOKEN);
  assert.equal(select(new Set([TOKEN])), TOKEN);
  assert.equal(select(new Set(["other", TOKEN])), TOKEN);
  assert.equal(select(new Set(["binary"])), false);
  assert.equal(select(new Set([TOKEN.slice(0, 63)])), false, "prefix");
  assert.equal(select(new Set([TOKEN + "0"])), false, "longer");
  assert.equal(select(new Set([TOKEN.toUpperCase()])), false, "case");
  assert.equal(select(new Set()), false);
});

test("selectProtocol without a token never selects", () => {
  assert.equal(selectProtocol(null)(new Set([TOKEN])), false);
});

async function withServer(terminalToken, fn) {
  const seen = [];
  const { server, wss } = startServer((ws, req, info) => seen.push({ protocol: ws.protocol, ...info }), 0, { terminalToken });
  await once(server, "listening");
  const url = `ws://127.0.0.1:${server.address().port}`;
  try {
    await fn(url, seen);
  } finally {
    wss.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function connect(url, protocols) {
  const ws = new WebSocket(url, protocols);
  const outcome = await Promise.race([once(ws, "open").then(() => "open"), once(ws, "error").then(([e]) => e.message)]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  ws.terminate();
  return outcome;
}

test("a client offering the token is a terminal", async () => {
  await withServer(TOKEN, async (url, seen) => {
    assert.equal(await connect(url, TOKEN), "open");
    assert.deepEqual(seen, [{ protocol: TOKEN, terminal: true }]);
  });
});

test("a client offering no protocol or another protocol is public", async () => {
  await withServer(TOKEN, async (url, seen) => {
    assert.equal(await connect(url), "open");
    await connect(url, "binary");
    assert.deepEqual(seen.map((s) => s.terminal), [false, false]);
  });
});

test("a wrong token is public; the ws client drops such a handshake itself", async () => {
  await withServer(TOKEN, async (url, seen) => {
    const outcome = await connect(url, "e".repeat(64));
    assert.match(outcome, /subprotocol/i);
    assert.deepEqual(seen.map((s) => s.terminal), [false]);
  });
});

test("without a configured token everyone is public", async () => {
  await withServer(null, async (url, seen) => {
    await connect(url, TOKEN);
    assert.deepEqual(seen.map((s) => s.terminal), [false]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/server-auth.test.js`
Expected: FAIL, `selectProtocol` is not exported (SyntaxError on import)

- [ ] **Step 3: Implement selection and the flag**

In `server.js` add the import and the factory:

```js
import { timingSafeEqual } from "crypto";

export function selectProtocol(token) {
  if (!token) return () => false;
  const expected = Buffer.from(token);
  return (protocols) => {
    for (const offered of protocols) {
      const candidate = Buffer.from(offered);
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return token;
    }
    return false;
  };
}
```

Change the signature and the server creation:

```js
export function startServer(serviceHandler, port, { photoStore = null, sweepMs = 60000, terminalToken = null } = {}) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, handleProtocols: selectProtocol(terminalToken) });
```

In the connection handler:

```js
  wss.on("connection", (ws, req) => {
    const terminal = Boolean(terminalToken) && ws.protocol === terminalToken;
    logger.info(`[WS] New ${terminal ? "terminal" : "public"} client connected with IP ${getClientIp(req)} - Total clients: ${wss.clients.size}`);
    if (!terminal && req.headers["sec-websocket-protocol"]) {
      logger.warn(`[WS] Client ${getClientIp(req)} offered an unrecognised subprotocol`);
    }
    ws.on("close", () => {
      logger.info(`[WS] Client disconnected with IP ${getClientIp(req)} - Total clients: ${wss.clients.size}`);
    });
    ws.on("error", (error) => {
      logger.error(`[WS] Error: ${error.message}`);
    });

    serviceHandler(ws, req, { terminal });
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/server-auth.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Run the whole suite**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 194`, `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add server.js test/server-auth.test.js
git commit -m "Mark websocket connections presenting TERMINAL_TOKEN as the terminal"
```

---

### Task 3: Welcome menu hides the photobooth from public connections

**Files:**
- Create: `slice/menu.js`
- Modify: `index.js`
- Test: `test/menu.test.js`

**Interfaces:**
- Consumes: `serviceHandler(ws, req, { terminal })` from Task 2; `terminalToken` from Task 1.
- Produces: `programsFor(programs, { terminal }) -> program[]` in `slice/menu.js`. Entries with `terminalOnly: true` are dropped unless `terminal` is true.

- [ ] **Step 1: Write the failing test**

```js
// test/menu.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { programsFor } from "../slice/menu.js";

const programs = [
  { key: "1", title: "calendar" },
  { key: "P", title: "photobooth", terminalOnly: true },
];

test("programsFor keeps terminal-only entries for the terminal", () => {
  assert.deepEqual(programsFor(programs, { terminal: true }).map((p) => p.key), ["1", "P"]);
});

test("programsFor drops terminal-only entries for public connections", () => {
  assert.deepEqual(programsFor(programs, { terminal: false }).map((p) => p.key), ["1"]);
  assert.deepEqual(programsFor(programs, {}).map((p) => p.key), ["1"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/menu.test.js`
Expected: FAIL, `Cannot find module '.../slice/menu.js'`

- [ ] **Step 3: Implement**

```js
// slice/menu.js
export function programsFor(programs, { terminal = false } = {}) {
  return programs.filter((program) => !program.terminalOnly || terminal);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/menu.test.js`
Expected: PASS, 2 tests

- [ ] **Step 5: Wire `index.js`**

Imports:

```js
import { programsFor } from "./slice/menu.js";
import { terminalToken } from "./config.js";
```

Mark the entry:

```js
  { key: "P", title: "photobooth", terminalOnly: true, handoff: createPhotobooth({ camera, store: photoStore, publicUrl: config.publicUrl, ttl: config.ttl }) },
```

Rename the module-level list to `allPrograms` and give the page its own list:

```js
async function welcomePage(websocket, req, { terminal = false } = {}) {
  const m = new Minitel(websocket);
  const programs = programsFor(allPrograms, { terminal });
```

The rest of `welcomePage` already uses `programs` for the menu, the prompt and the lookup, so `P` on a public connection falls into the "Invalid option" branch.

Startup:

```js
  const token = terminalToken();
  if (!token) logger.warn("TERMINAL_TOKEN is unset or shorter than 32 characters: no connection can use the photobooth");
  startServer(welcomePage, 3615, { photoStore, terminalToken: token });
```

- [ ] **Step 6: Verify both menus by hand against a throwaway server**

Run, with a 64-character throwaway token in the environment and the user's dev server stopped:

```bash
TERMINAL_TOKEN=$(printf 'a%.0s' $(seq 64)) node index.js > /tmp/slice.log 2>&1 &
sleep 3
node -e '
import("ws").then(({ default: WebSocket }) => {
  const probe = (protocols, label) => new Promise((resolve) => {
    const ws = new WebSocket("ws://localhost:3615", protocols);
    let s = "";
    ws.on("message", (d) => { s += d.toString("latin1"); });
    setTimeout(() => { console.log(label, /photobooth/.test(s) ? "shows photobooth" : "no photobooth", /\(1,2,3,V(,P)?\)/.exec(s)?.[0]); ws.close(); resolve(); }, 2500);
  });
  probe(undefined, "public").then(() => probe("a".repeat(64), "terminal"));
});'
kill %1
```

Expected: `public no photobooth (1,2,3,V)` then `terminal shows photobooth (1,2,3,V,P)`; the startup log has no TERMINAL_TOKEN warning. Then run once more without the variable and check the log line `TERMINAL_TOKEN is unset` appears. Port 3615 is free afterwards.

- [ ] **Step 7: Run the whole suite**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 196`, `# fail 0`

- [ ] **Step 8: Commit**

```bash
git add slice/menu.js test/menu.test.js index.js
git commit -m "Welcome menu offers the photobooth only to the terminal connection"
```

---

### Task 4: Playground, `/lib` and `/api/vdt` are local-only

**Files:**
- Modify: `server.js`
- Test: `test/api.test.js`

**Interfaces:**
- Produces: `isTunnelRequest(req) -> boolean` exported from `server.js` (true when `cf-connecting-ip` is present).

- [ ] **Step 1: Write the failing tests**

Append to `test/api.test.js`:

```js
const viaTunnel = { headers: { "cf-connecting-ip": "203.0.113.7" } };

test("playground, lib and the conversion endpoint answer 404 through the tunnel", async () => {
  for (const path of ["/playground.html", "/lib/screen.js", "/lib/image/presets.js"]) {
    const res = await fetch(`${base}${path}`, viaTunnel);
    assert.equal(res.status, 404, path);
  }
  const post = await fetch(`${base}/api/vdt?cols=4&rows=2`, { ...viaTunnel, method: "POST", body: await grey() });
  assert.equal(post.status, 404);
});

test("the emulator and its library stay public through the tunnel", async () => {
  for (const path of ["/", "/library/minitel.js"]) {
    const res = await fetch(`${base}${path}`, viaTunnel);
    assert.equal(res.status, 200, path);
  }
});

test("playground, lib and the conversion endpoint serve locally", async () => {
  for (const path of ["/playground.html", "/lib/screen.js", "/lib/image/presets.js"]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 200, path);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/api.test.js`
Expected: the first new test FAILS on `/playground.html` with `Expected values to be strictly equal: 200 !== 404`; the other two pass.

- [ ] **Step 3: Implement the guard**

In `server.js`, above `startServer`:

```js
export function isTunnelRequest(req) {
  return Boolean(req.headers["cf-connecting-ip"]);
}

const LOCAL_ONLY = /^\/(playground\.html|lib\/|api\/vdt$)/;
```

Inside `startServer`, right after the logging middleware and before the `/api/vdt` route:

```js
  app.use((req, res, next) => {
    if (LOCAL_ONLY.test(req.path) && isTunnelRequest(req)) {
      logger.warn(`[HTTP] local-only path refused through the tunnel - ${req.method} ${req.path} - ${getClientIp(req)}`);
      return res.status(404).type("text").send("Not Found");
    }
    next();
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/api.test.js`
Expected: PASS, all tests in the file

- [ ] **Step 5: Run the whole suite**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 199`, `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add server.js test/api.test.js
git commit -m "Playground, /lib and /api/vdt are refused through the Cloudflare tunnel"
```

---

### Task 5: `.env` to `config.h` generator

**Files:**
- Create: `bin/esp32-config.js`
- Test: `test/esp32-config.test.js`

**Interfaces:**
- Produces: `parseEnv(text) -> object`, `websocketTarget(publicUrl) -> { host, port, ssl }`, `networksFrom(env) -> [{ ssid, password }]`, `renderHeader(env) -> string`, all exported from `bin/esp32-config.js`; running the file writes `esp32/client/config.h` from the repository's `.env`.

- [ ] **Step 1: Write the failing tests**

```js
// test/esp32-config.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv, websocketTarget, networksFrom, renderHeader } from "../bin/esp32-config.js";

const run = promisify(execFile);

test("parseEnv reads key=value lines, ignores comments and blanks, strips quotes and CR", () => {
  const env = parseEnv('# c\nA=1\r\nB="two words"\n\nC=x=y\n  D = spaced \n');
  assert.deepEqual(env, { A: "1", B: "two words", C: "x=y", D: "spaced" });
});

test("websocketTarget derives host, port and tls from PUBLIC_URL", () => {
  assert.deepEqual(websocketTarget("https://slice.example.com"), { host: "slice.example.com", port: 443, ssl: true });
  assert.deepEqual(websocketTarget("https://slice.example.com/"), { host: "slice.example.com", port: 443, ssl: true });
  assert.deepEqual(websocketTarget("http://minitelpi:3615"), { host: "minitelpi", port: 3615, ssl: false });
  assert.deepEqual(websocketTarget("http://minitelpi"), { host: "minitelpi", port: 3615, ssl: false });
  assert.throws(() => websocketTarget("minitelpi:3615"), /PUBLIC_URL/);
});

test("networksFrom collects numbered pairs in order and stops at the first gap", () => {
  const env = { WIFI_SSID_1: "a", WIFI_PASSWORD_1: "pa", WIFI_SSID_2: "b", WIFI_PASSWORD_2: "pb", WIFI_SSID_4: "d", WIFI_PASSWORD_4: "pd" };
  assert.deepEqual(networksFrom(env), [{ ssid: "a", password: "pa" }, { ssid: "b", password: "pb" }]);
  assert.deepEqual(networksFrom({ WIFI_SSID_1: "open" }), [{ ssid: "open", password: "" }]);
  assert.throws(() => networksFrom({}), /WIFI_SSID_1/);
});

test("renderHeader writes the defines and the networks array with escaping", () => {
  const header = renderHeader({
    PUBLIC_URL: "https://slice.example.com",
    TERMINAL_TOKEN: "t".repeat(40),
    WIFI_SSID_1: 'say "hi"',
    WIFI_PASSWORD_1: "back\\slash",
  });
  assert.match(header, /#define WS_HOST "slice\.example\.com"/);
  assert.match(header, /#define WS_PORT 443/);
  assert.match(header, /#define WS_SSL true/);
  assert.match(header, /#define WS_PATH "\/"/);
  assert.match(header, new RegExp(`#define WS_PROTOCOL "${"t".repeat(40)}"`));
  assert.match(header, /\{ "say \\"hi\\"", "back\\\\slash" \}/);
  assert.match(header, /const int networkCount = 1;/);
  assert.match(renderHeader({ PUBLIC_URL: "http://minitelpi:3615", WIFI_SSID_1: "x" }), /#define WS_PROTOCOL ""/, "no token means an empty protocol");
});

test("the script writes the header from .env and fails without PUBLIC_URL", async () => {
  const dir = await mkdtemp(join(tmpdir(), "esp32cfg-"));
  await writeFile(join(dir, ".env"), "PUBLIC_URL=https://slice.example.com\nWIFI_SSID_1=g\nWIFI_PASSWORD_1=p\n");
  const out = join(dir, "config.h");
  await run("node", ["bin/esp32-config.js", "--env", join(dir, ".env"), "--out", out]);
  assert.match(await readFile(out, "utf8"), /WS_HOST "slice\.example\.com"/);
  await writeFile(join(dir, ".env"), "WIFI_SSID_1=g\n");
  await assert.rejects(run("node", ["bin/esp32-config.js", "--env", join(dir, ".env"), "--out", out]), /PUBLIC_URL/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/esp32-config.test.js`
Expected: FAIL, `Cannot find module '.../bin/esp32-config.js'`

- [ ] **Step 3: Implement the generator**

```js
#!/usr/bin/env node
// bin/esp32-config.js
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 3615;

export function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

export function websocketTarget(publicUrl) {
  let url;
  try {
    url = new URL(publicUrl);
  } catch {
    throw new Error(`PUBLIC_URL must be an absolute http or https url, got ${JSON.stringify(publicUrl)}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`PUBLIC_URL must be http or https, got ${url.protocol}`);
  const ssl = url.protocol === "https:";
  const port = url.port ? Number(url.port) : ssl ? 443 : DEFAULT_PORT;
  return { host: url.hostname, port, ssl };
}

export function networksFrom(env) {
  const networks = [];
  for (let i = 1; env[`WIFI_SSID_${i}`]; i++) {
    networks.push({ ssid: env[`WIFI_SSID_${i}`], password: env[`WIFI_PASSWORD_${i}`] ?? "" });
  }
  if (networks.length === 0) throw new Error("WIFI_SSID_1 is required");
  return networks;
}

const cString = (text) => `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function renderHeader(env) {
  if (!env.PUBLIC_URL) throw new Error("PUBLIC_URL is required");
  const target = websocketTarget(env.PUBLIC_URL);
  const networks = networksFrom(env);
  const token = (env.TERMINAL_TOKEN ?? "").trim();
  const lines = [
    "// Generated by bin/esp32-config.js from .env. Do not edit, do not commit.",
    "#pragma once",
    "",
    `#define WS_HOST ${cString(target.host)}`,
    `#define WS_PORT ${target.port}`,
    `#define WS_SSL ${target.ssl}`,
    '#define WS_PATH "/"',
    `#define WS_PROTOCOL ${cString(token)}`,
    "",
    "struct WiFiNetwork {",
    "  const char* ssid;",
    "  const char* password;",
    "};",
    "",
    "const WiFiNetwork networks[] = {",
    ...networks.map((n, i) => `  { ${cString(n.ssid)}, ${cString(n.password)} }${i < networks.length - 1 ? "," : ""}`),
    "};",
    `const int networkCount = ${networks.length};`,
    "",
  ];
  return lines.join("\n");
}

function main(argv) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const arg = (name, fallback) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const envPath = arg("--env", resolve(root, ".env"));
  const outPath = arg("--out", resolve(root, "esp32", "client", "config.h"));
  let text;
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    console.error(`${envPath} not found. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  const header = renderHeader(parseEnv(text));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, header);
  console.error(`wrote ${outPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/esp32-config.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Run the whole suite**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 204`, `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add bin/esp32-config.js test/esp32-config.test.js
git commit -m "Add bin/esp32-config.js writing the ESP32 config header from .env"
```

---

### Task 6: ESP32 sketch in the repository, arduino-cli scripts and README

**Files:**
- Create: `esp32/client/client.ino`
- Create: `esp32/README.md`
- Modify: `package.json` (esp32 scripts)
- Modify: `README.md` (link)

**Interfaces:**
- Consumes: `esp32/client/config.h` as written by Task 5, with `WS_HOST`, `WS_PORT`, `WS_SSL`, `WS_PATH`, `WS_PROTOCOL`, `networks[]`, `networkCount`.

- [ ] **Step 1: Copy the sketch and replace its configuration block**

```bash
mkdir -p esp32/client
cp /Users/ucodia/code/Minitel-ESP32/arduino/Minitel1B_Websocket_Client/Minitel1B_Websocket_Client.ino esp32/client/client.ino
```

In `esp32/client/client.ino`, replace the header comment with:

```cpp
/*
 * 3615 SLICE terminal: bridges a Minitel to the videotex server over a websocket.
 * Configuration comes from config.h, generated from .env by `npm run esp32:config`.
 * Based on Minitel1B_Websocket_Client by iodeo (dec 2021).
 */
```

Delete everything from `// ------ WiFi credentials` up to and including the `/**/` line that closes the websocket server block, and put in its place:

```cpp
// ---------------------------------------
// ------ WiFi and server configuration, see config.h

#include "config.h"

#define WIFI_CONNECT_TIMEOUT_MS 10000

const char* host = WS_HOST;
const int port = WS_PORT;
const char* path = WS_PATH;
const bool ssl = WS_SSL;
const int ping_ms = 0;
const char* protocol = WS_PROTOCOL;
```

The `#include` lines for `WiFi.h`, `WebSocketsClient.h` and `Minitel1B_Hard.h`, the Minitel and debug blocks, `connectWiFi`, `connectWebSocket`, `setup`, `loop` and `webSocketEvent` stay exactly as they are. `connectWiFi` keeps logging the SSID it tries; it never logs a password, and nothing logs `protocol`.

- [ ] **Step 2: Generate the header from a throwaway `.env` and check the sketch reads it**

```bash
printf 'PUBLIC_URL=http://minitelpi:3615\nWIFI_SSID_1=test\nWIFI_PASSWORD_1=test\n' > /tmp/esp32-test.env
node bin/esp32-config.js --env /tmp/esp32-test.env --out esp32/client/config.h
grep -c "WS_HOST\|networks\[\]" esp32/client/config.h
git status --short esp32
```

Expected: `2`; `git status` lists only `esp32/client/client.ino` as untracked, never `config.h`.

- [ ] **Step 3: Add the npm scripts**

In `package.json` scripts:

```json
"esp32:config": "node bin/esp32-config.js",
"esp32:build": "npm run esp32:config && arduino-cli compile --fqbn esp32:esp32:esp32 esp32/client",
"esp32:flash": "npm run esp32:build && arduino-cli upload --fqbn esp32:esp32:esp32 -p ${ESP32_PORT:-/dev/cu.usbserial-0001} esp32/client",
"esp32:monitor": "arduino-cli monitor -p ${ESP32_PORT:-/dev/cu.usbserial-0001} -c baudrate=115200"
```

- [ ] **Step 4: Install arduino-cli, the core and the libraries, then compile**

```bash
brew install arduino-cli
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32
arduino-cli lib install WebSockets Minitel1B_Hard
npm run esp32:build 2>&1 | tail -3
```

Expected: the last lines report the sketch size, `Sketch uses N bytes`, and no error. The core download is large (about 1 GB); if this machine cannot install it, record a ruling and leave the compile to the user on the flashing machine, with the README as the contract.

- [ ] **Step 5: Write `esp32/README.md`**

```markdown
# ESP32 terminal client

The sketch in `client/` connects a Minitel to the 3615 SLICE server over a websocket, forwarding keys up and videotex bytes down. It is the `Minitel1B_Websocket_Client` sketch from the Minitel-ESP32 project with its configuration moved to a generated header.

## Configuration

Everything comes from the repository's `.env` (copy `.env.example`): the Wi-Fi networks, `PUBLIC_URL` and `TERMINAL_TOKEN`. `npm run esp32:config` writes `client/config.h` from it; the file is ignored by git and regenerated by every build.

- `PUBLIC_URL=https://slice.ucodia.space` connects with TLS on port 443.
- `PUBLIC_URL=http://minitelpi:3615` connects to a server on the local network, for testing.
- `TERMINAL_TOKEN` is sent as the websocket subprotocol. The server shows the photobooth only to connections presenting it.

## Tooling

Install arduino-cli, the ESP32 core and the two libraries once:

    brew install arduino-cli
    arduino-cli config init
    arduino-cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
    arduino-cli core update-index
    arduino-cli core install esp32:esp32
    arduino-cli lib install WebSockets Minitel1B_Hard

`WebSockets` is the Links2004 arduinoWebSockets library, `Minitel1B_Hard` is Eric Sérandour's. The board is `esp32:esp32:esp32` (ESP32 Dev Module), set in `package.json`.

## Build and flash

Plug the board in and find its port:

    arduino-cli board list

Then, with the port in `ESP32_PORT` (default `/dev/cu.usbserial-0001`):

    npm run esp32:build                       # config.h, then compile
    ESP32_PORT=/dev/cu.usbserial-0001 npm run esp32:flash
    ESP32_PORT=/dev/cu.usbserial-0001 npm run esp32:monitor

The monitor runs at 115200 baud. A good boot prints the detected Minitel baud rate, the network it joined with its IP, then `[WS] Connected to url: /`, and the welcome page appears on the Minitel with the photobooth entry. A wrong token still connects but the menu has no `P` entry; a wrong host or an unreachable network loops on reconnect messages.
```

- [ ] **Step 6: Link from the root README**

In `README.md`, after the photobooth section's environment table, add:

```markdown
The gallery terminal is an ESP32 bridging the Minitel to this server. Its firmware lives in [`esp32/`](esp32/README.md) and is configured from the same `.env`.
```

- [ ] **Step 7: Verify the ignore rule once more and commit**

```bash
git status --short | grep -c config.h
git add esp32/client/client.ino esp32/README.md package.json README.md
git commit -m "Add the ESP32 terminal client with arduino-cli build scripts, configured from .env"
```

Expected: the grep prints `0`.

---

### Task 7: Install script reads `.env`, README documents configuration and the security model

**Files:**
- Modify: `install.sh`
- Modify: `README.md`

- [ ] **Step 1: Replace the prompt with `.env` checks**

In `install.sh`, replace the block from `DEFAULT_PUBLIC_URL=` through `PUBLIC_URL="${PUBLIC_URL%/}"` with:

```bash
ENV_FILE="${APP_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing ${ENV_FILE}. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi
env_value() { grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/'; }
if [ -z "$(env_value PUBLIC_URL)" ]; then
  echo "PUBLIC_URL is empty in ${ENV_FILE}." >&2
  exit 1
fi
TOKEN_VALUE="$(env_value TERMINAL_TOKEN)"
if [ "${#TOKEN_VALUE}" -lt 32 ]; then
  echo "Warning: TERMINAL_TOKEN is missing or shorter than 32 characters; the photobooth will be unavailable." >&2
fi
```

In the unit heredoc, change `ExecStart=${NODE_BIN} index.js` to `ExecStart=${NODE_BIN} --env-file-if-exists=.env index.js` and delete the `Environment=PUBLIC_URL=${PUBLIC_URL}` line.

- [ ] **Step 2: Check the script without running it**

```bash
bash -n install.sh && echo "syntax ok"
cd "$(mktemp -d)" && cp /Users/ucodia/code/3615-UCODIA/install.sh . && printf '{}' > package-lock.json && bash install.sh; echo "exit $?"; cd - >/dev/null
```

Expected: `syntax ok`, then `Missing .../.env. Copy .env.example to .env and fill it in first.` and `exit 1`, before any npm or sudo call.

- [ ] **Step 3: README**

Replace the install paragraph's sentence about the prompt with:

```markdown
This installs production dependencies (skipped when `package-lock.json` and the Node version are unchanged since the last install), checks that `.env` exists with a `PUBLIC_URL`, writes `/etc/systemd/system/slice.service` pointing at this repo and loading `.env`, enables it at boot and restarts it.
```

Add a `## Configuration` section before the photobooth section:

```markdown
## Configuration

Copy `.env.example` to `.env` and fill it in. The file is ignored by git and read by the server (`npm start`, `npm run dev` and the service load it with Node's `--env-file-if-exists`, Node 22.9 or later), by `install.sh` and by the ESP32 build. Shell variables override it.

| key | meaning |
| --- | --- |
| `PUBLIC_URL` | public base URL, used for download links and as the ESP32's websocket target |
| `TERMINAL_TOKEN` | shared secret the ESP32 presents as its websocket subprotocol; at least 32 characters, `openssl rand -hex 32` |
| `WIFI_SSID_n`, `WIFI_PASSWORD_n` | networks the ESP32 tries in order, numbered from 1 |
| `PHOTOBOOTH_*` | optional, see the photobooth section |

### Who gets what

The emulator page and the download route are public. A websocket connection presenting `TERMINAL_TOKEN` is the gallery terminal and is the only one offered the photobooth, so the webcam next to the Minitel can only be triggered from the Minitel. Everyone else sees the menu without it. The playground, the `/lib` modules and `POST /api/vdt` are local tools: requests arriving through the Cloudflare tunnel (they carry `cf-connecting-ip`) get a 404, so they work at `http://localhost:3615` and on the LAN only. This assumes the tunnel is the only public path to the server.
```

In the photobooth section, drop the sentence telling the user to set `PUBLIC_URL` on the Pi, since `.env` covers it, and change the environment table's `PUBLIC_URL` row default to `http://localhost:3615` if not already.

- [ ] **Step 4: Run the whole suite and commit**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 204`, `# fail 0`

```bash
git add install.sh README.md
git commit -m "install.sh reads .env instead of prompting; README documents configuration and who gets the photobooth"
```

---

### Task 8: Remove the secrets from the Minitel-ESP32 clone

**Files:**
- None in this repository. Acts on `/Users/ucodia/code/Minitel-ESP32`.

- [ ] **Step 1: Confirm the sketch copy in this repository is complete**

```bash
diff <(sed -n '/^void connectWiFi/,$p' /Users/ucodia/code/Minitel-ESP32/arduino/Minitel1B_Websocket_Client/Minitel1B_Websocket_Client.ino) <(sed -n '/^void connectWiFi/,$p' esp32/client/client.ino) && echo "functions identical"
```

Expected: `functions identical`

- [ ] **Step 2: Drop the branch and purge the commit**

```bash
cd /Users/ucodia/code/Minitel-ESP32
git status --short | wc -l
git checkout main
git branch -D password-protection
git reflog expire --expire=now --all
git gc --prune=now --quiet
git log --all --oneline | grep -c "multiple SSIDs"
git status -sb | head -1
cd -
```

Expected: `0` uncommitted files before the switch (if not, stop and report); `0` matching commits after; `## main...origin/main`.

- [ ] **Step 3: Commit nothing here; record in the ledger that the clone is clean.**

---

### Task 9: End-to-end on the Pi and the terminal

**Files:** none. Verification with the user.

- [ ] **Step 1: On the Mac, create the real `.env`**

The user fills `.env` from `.env.example` with the gallery values and a token from `openssl rand -hex 32`. Never echo the file.

- [ ] **Step 2: Deploy to the Pi**

```bash
git push
ssh minitelpi 'cd ~/code/3615-UCODIA && git pull --ff-only'
scp .env minitelpi:~/code/3615-UCODIA/.env
ssh minitelpi 'cd ~/code/3615-UCODIA && ./install.sh 2>&1 | tail -5 && sleep 2 && journalctl -u slice --no-pager -n 5 -o cat'
```

Expected: `active (running)` in the status, the log shows the camera line and no `TERMINAL_TOKEN is unset` warning.

- [ ] **Step 3: Public path has no photobooth**

From the Mac, run the probe from Task 3 step 6 against `wss://slice.ucodia.space` without a protocol, and against `http://minitelpi:3615` with the token from `.env` read into a variable (`TOKEN=$(grep ^TERMINAL_TOKEN= .env | cut -d= -f2-)`).

Expected: public `no photobooth (1,2,3,V)`; terminal `shows photobooth (1,2,3,V,P)`. Also `curl -s -o /dev/null -w "%{http_code}\n" https://slice.ucodia.space/playground.html` prints `404` and the same for `http://minitelpi:3615/playground.html` prints `200`.

- [ ] **Step 4: Flash the ESP32 and watch it connect**

```bash
ESP32_PORT=$(arduino-cli board list | awk '/usb/ {print $1; exit}') npm run esp32:flash
ESP32_PORT=... npm run esp32:monitor
```

Expected on the monitor: the Wi-Fi line, `[WS] Connected to url: /`; on the Minitel: the welcome page with `P - photobooth`; a capture and a download whose QR opens on a phone.

- [ ] **Step 5: Log the outcome in the meta-repo execution log.**
