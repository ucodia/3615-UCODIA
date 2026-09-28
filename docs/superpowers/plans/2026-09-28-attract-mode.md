# Attract Mode and Keep-Alive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After 180 s without a key, every connection shows an animated "press any key" screen that also keeps the Minitel awake; any key returns to the welcome page; a keep-alive byte keeps the terminal from blanking while a page is in use.

**Architecture:** The Minitel class stamps every incoming message and gains a cancellable read. `slice/attract.js` holds the idle timer, the keep-alive and the attract screen. The welcome loop in `index.js` catches the idle error, runs the attract screen and redraws. Two pages move their timer cleanup into `finally`.

**Tech Stack:** Node 22 ESM, `ws`, `node --test`, the `Screen` model and `drawBitmap`.

**Spec:** `docs/superpowers/specs/2026-09-28-attract-mode-design.md`

## Global Constraints

- Lean version agreed on 2026-09-28: about 125 lines of code, real timers, welcome page stays in `index.js`.
- Defaults: `IDLE_SECONDS=180`, `KEEPALIVE_SECONDS=30`; the idle delay must stay below the terminal's own four to five minutes.
- The keep-alive byte is NUL, `"\x00"`, pending the hardware check in Task 5.
- Nothing writes to the socket while `runAttract` runs except `runAttract`.
- Pages never catch `IdleError`; only the welcome loop does.
- Tests fail fast with timeouts as the photobooth tests do; no test may hang.
- Commits: concise, precise, no co-author, no AI mention, no links. Suite starts at 213 passing.

## Review Focus

1. A key that arrives while the attract screen is redrawing a frame is dropped; the next key still wakes (Task 2 tests the wake, Task 4 probes it live).
2. Idle expiry while the photobooth is capturing: the capture awaits the camera, not the keyboard, so the cancellation lands on the next key read and the erase timer is still cleared (Task 3 test).
3. A socket that closes during the attract screen: the read rejects or never resolves; `runAttract` must not keep a timer alive after the close (Task 2: the frame timer is cleared on every exit path; Task 4 probe closes the socket mid-attract and checks the process logs no error).
4. `KEEPALIVE_SECONDS=0` disables the keep-alive without disabling the idle timer (Task 1 config test, Task 2 timer test).
5. A public emulator connection idles like the terminal; the browser shows the attract screen too, which is intended (Task 4 probe runs without the token).

---

### Task 1: Activity stamp, cancellable read, IdleError, config keys

**Files:**
- Modify: `minitel.js`
- Modify: `config.js`
- Test: `test/minitel-read.test.js` (new), `test/config.test.js`

**Interfaces:**
- Produces: `export class IdleError extends Error` in `minitel.js`; `m.lastActivity` (ms timestamp); `m.cancelRead(error)`; `idleConfig(env = process.env) -> { idleMs, keepaliveMs }` in `config.js`.

- [ ] **Step 1: Write the failing tests**

```js
// test/minitel-read.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { Minitel, IdleError } from "../minitel.js";

function fakeSocket() {
  const ws = { sent: [], handlers: {}, onmessage: null };
  ws.send = async (data) => { ws.sent.push(data); };
  ws.on = (event, fn) => { ws.handlers[event] = fn; };
  ws.deliver = (data) => { ws.handlers.message?.(data); ws.onmessage?.({ data }); };
  return ws;
}

const within = (promise, ms = 300) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("hung")), ms))]);

test("lastActivity is stamped on every message, even when nothing is reading", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const before = m.lastActivity;
  await new Promise((r) => setTimeout(r, 5));
  ws.deliver("x");
  assert.ok(m.lastActivity > before);
});

test("cancelRead rejects a pending key read with the given error and later reads work", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const pending = m.key();
  m.cancelRead(new IdleError());
  await assert.rejects(within(pending), IdleError);
  const next = m.key();
  ws.deliver("a");
  assert.deepEqual(await within(next), ["a", 0]);
});

test("cancelRead with nothing pending is a no-op", () => {
  const m = new Minitel(fakeSocket());
  m.cancelRead(new IdleError());
});

test("input propagates the cancellation", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const pending = m.input(23, 2, 1, "", " ", false, true);
  await new Promise((r) => setTimeout(r, 5));
  m.cancelRead(new IdleError());
  await assert.rejects(within(pending), IdleError);
});
```

Append to `test/config.test.js`:

```js
import { idleConfig } from "../config.js";

test("idleConfig defaults to 180 s idle and 30 s keep-alive and reads the environment", () => {
  assert.deepEqual(idleConfig({}), { idleMs: 180000, keepaliveMs: 30000 });
  assert.deepEqual(idleConfig({ IDLE_SECONDS: "60", KEEPALIVE_SECONDS: "0" }), { idleMs: 60000, keepaliveMs: 0 });
  assert.deepEqual(idleConfig({ IDLE_SECONDS: "abc", KEEPALIVE_SECONDS: "-3" }), { idleMs: 180000, keepaliveMs: 30000 });
});
```

(Put the import next to the existing `terminalToken` import at the top of the file.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/minitel-read.test.js test/config.test.js`
Expected: FAIL, `does not provide an export named 'IdleError'` and `'idleConfig'`

- [ ] **Step 3: Implement**

In `minitel.js`, after the `__dirname` line:

```js
export class IdleError extends Error {
  constructor() {
    super("idle");
    this.name = "IdleError";
  }
}
```

In the class, add a private field and the stamp in the constructor (right after `this.ws = websocket;`):

```js
  #pendingReject = null;
```

```js
    this.lastActivity = Date.now();
    if (typeof websocket.on === "function") {
      websocket.on("message", () => { this.lastActivity = Date.now(); });
    }
```

Replace `#read`:

```js
  async #read(maxlen = 1) {
    if (this.buffer.length < maxlen) {
      try {
        const data = await new Promise((resolve, reject) => {
          this.#pendingReject = reject;
          this.ws.onmessage = (event) => resolve(event.data);
        });
        this.buffer += data;
      } finally {
        this.#pendingReject = null;
      }
    }

    let data = "";
    if (this.buffer.length >= maxlen) {
      data = this.buffer.substring(0, maxlen);
      this.buffer = this.buffer.substring(maxlen);
    }

    return data;
  }

  // Rejects the read a page is waiting on, if any; used by the idle timer.
  cancelRead(error) {
    const reject = this.#pendingReject;
    this.#pendingReject = null;
    if (reject) reject(error);
  }
```

In `config.js`:

```js
const DEFAULT_IDLE_S = 180;
const DEFAULT_KEEPALIVE_S = 30;

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
```

Note: `env.IDLE_SECONDS` undefined gives `Number(undefined) = NaN`, so the fallback applies; an explicit `"0"` keep-alive is kept as 0.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/minitel-read.test.js test/config.test.js`
Expected: PASS, 8 tests

- [ ] **Step 5: Run the whole suite**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 218`, `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add minitel.js config.js test/minitel-read.test.js test/config.test.js
git commit -m "Minitel class stamps activity on every message and can cancel a pending read; IDLE_SECONDS and KEEPALIVE_SECONDS"
```

---

### Task 2: Idle timer, keep-alive and the attract screen

**Files:**
- Create: `slice/attract.js`
- Test: `test/attract.test.js`

**Interfaces:**
- Consumes: `m.lastActivity`, `m.cancelRead`, `m.send`, `m.key`, `m.home`, `m.cls` from Task 1 and the class.
- Produces: `startIdle(m, { idleMs, keepaliveMs, keepalive = "\x00", onIdle }) -> { stop() }`; `renderAttract(step) -> Screen`; `runAttract(m, { frameMs = 5000 } = {}) -> Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```js
// test/attract.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { startIdle, renderAttract, runAttract } from "../slice/attract.js";
import { encode } from "../screen.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stub() {
  const m = { lastActivity: Date.now(), sent: [], pending: null, queue: [] };
  m.send = async (data) => { m.sent.push(data); };
  m.home = async () => { m.sent.push("home"); };
  m.cls = async () => { m.sent.push("cls"); };
  m.key = () => new Promise((resolve) => { m.pending = resolve; });
  m.press = (char) => { const r = m.pending; m.pending = null; if (r) r([char, 0]); };
  return m;
}

test("startIdle fires after idleMs of silence and not before", async () => {
  const m = stub();
  let fired = 0;
  const idle = startIdle(m, { idleMs: 40, keepaliveMs: 0, onIdle: () => fired++ });
  await sleep(20);
  assert.equal(fired, 0);
  await sleep(40);
  assert.equal(fired, 1);
  idle.stop();
});

test("activity in between postpones the idle timer", async () => {
  const m = stub();
  let fired = 0;
  const idle = startIdle(m, { idleMs: 40, keepaliveMs: 0, onIdle: () => fired++ });
  await sleep(25);
  m.lastActivity = Date.now();
  await sleep(25);
  assert.equal(fired, 0, "the countdown restarted from the activity");
  await sleep(40);
  assert.equal(fired, 1);
  idle.stop();
});

test("keep-alive sends the byte at its interval and stop cancels everything", async () => {
  const m = stub();
  const idle = startIdle(m, { idleMs: 1000, keepaliveMs: 15, onIdle: () => {} });
  await sleep(50);
  const beats = m.sent.filter((s) => s === "\x00").length;
  assert.ok(beats >= 2 && beats <= 4, `beats ${beats}`);
  idle.stop();
  const after = m.sent.length;
  await sleep(40);
  assert.equal(m.sent.length, after, "nothing after stop");
});

test("keepaliveMs 0 disables the keep-alive only", async () => {
  const m = stub();
  let fired = 0;
  const idle = startIdle(m, { idleMs: 20, keepaliveMs: 0, onIdle: () => fired++ });
  await sleep(50);
  assert.equal(m.sent.length, 0);
  assert.equal(fired, 1);
  idle.stop();
});

test("renderAttract moves between steps and always says press any key", () => {
  const a = encode(renderAttract(0));
  const b = encode(renderAttract(1));
  assert.notEqual(Buffer.from(a).toString("latin1"), Buffer.from(b).toString("latin1"));
  for (const step of [0, 1, 2, 3, 4]) {
    const text = Buffer.from(encode(renderAttract(step))).toString("latin1");
    assert.match(text, /press any key/);
    assert.match(text, /3615 SLICE/);
  }
  assert.equal(Buffer.from(encode(renderAttract(5))).toString("latin1"), Buffer.from(encode(renderAttract(0))).toString("latin1"), "the path wraps");
});

test("runAttract redraws on each timeout and returns on a key without another frame", async () => {
  const m = stub();
  const done = runAttract(m, { frameMs: 20 });
  await sleep(55);
  const frames = m.sent.filter((s) => s !== "home" && s !== "cls").length;
  assert.ok(frames >= 3, `frames ${frames}`);
  m.press("x");
  await Promise.race([done, sleep(200).then(() => { throw new Error("hung"); })]);
  const after = m.sent.length;
  await sleep(50);
  assert.equal(m.sent.length, after, "no frame after the key");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/attract.test.js`
Expected: FAIL, `Cannot find module '.../slice/attract.js'`

- [ ] **Step 3: Implement**

```js
// slice/attract.js
import { Screen, encode } from "../screen.js";
import { drawBitmap } from "../mosaic.js";

const ROWS = 24;
const COLS = 40;
const BLANC = 7;
const CYAN = 6;
const VERT = 2;

// 16 by 15 pixel smiley: 8 columns by 5 rows of mosaic cells
const SMILEY = [
  ".....######.....",
  "...##......##...",
  "..#..........#..",
  ".#....#..#....#.",
  "#.....#..#.....#",
  "#..............#",
  "#..............#",
  "#..#........#..#",
  "#...#......#...#",
  ".#...######...#.",
  ".#............#.",
  "..#..........#..",
  "...##......##...",
  ".....######.....",
  "................",
].map((line) => [...line].map((ch) => (ch === "#" ? 1 : 0)));

// top-left cell of the sprite for each step; the text sits under it
const PATH = [
  [3, 17],
  [3, 4],
  [13, 30],
  [13, 4],
  [8, 17],
];

export function renderAttract(step) {
  const [row, col] = PATH[step % PATH.length];
  const screen = new Screen(ROWS, COLS);
  drawBitmap(screen, row, col, SMILEY, { fg: BLANC });
  screen.text(row + 5, col - 1, "3615 SLICE", { fg: VERT });
  screen.text(row + 6, col - 3, " press any key ", { fg: CYAN, inverse: true });
  return screen;
}

// Idle countdown against m.lastActivity plus a keep-alive byte; stop() clears both.
export function startIdle(m, { idleMs, keepaliveMs, keepalive = "\x00", onIdle }) {
  let idleTimer = null;
  const arm = (delay) => {
    idleTimer = setTimeout(() => {
      const remaining = idleMs - (Date.now() - m.lastActivity);
      if (remaining > 0) arm(remaining);
      else onIdle();
    }, delay);
  };
  arm(idleMs);
  const beat = keepaliveMs > 0 ? setInterval(() => { m.send(keepalive).catch(() => {}); }, keepaliveMs) : null;
  return {
    stop() {
      clearTimeout(idleTimer);
      if (beat) clearInterval(beat);
    },
  };
}

// Draws the moving invitation until a key arrives; that key is consumed here.
export async function runAttract(m, { frameMs = 5000 } = {}) {
  let step = 0;
  const frame = async () => {
    await m.home();
    await m.cls();
    await m.send(encode(renderAttract(step++)));
  };
  await frame();
  while (true) {
    const woke = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), frameMs);
      m.key().then(() => { clearTimeout(timer); resolve(true); }, () => { clearTimeout(timer); resolve(true); });
    });
    if (woke) return;
    await frame();
  }
}
```

Note on the wake race: as on the photobooth's QR page, a key read that loses the race stays pending in the class and swallows the next message; that message is the wake key, which is consumed either way. A rejected read, on socket close, also ends the loop.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/attract.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Look at the screen once**

Run, from the repo root, with the user's dev server left alone:

```bash
node -e 'import("./slice/attract.js").then(async ({ renderAttract }) => { const { encode } = await import("./screen.js"); for (const s of [0, 2]) process.stdout.write(Buffer.from(encode(renderAttract(s))).toString("base64") + "\n"); })' > /tmp/attract.b64
```

Then render both frames through the emulator with the throwaway probe page used earlier in the project (a page with `data-socket="none"` calling `directSend` on the decoded bytes, screenshot with headless Chrome on a port other than 3615). Expected: a round smiley, "3615 SLICE" under it and the inverse "press any key" pill, at two different places. Adjust `PATH` if a frame clips the edge; the sprite is 8 by 5 cells and the pill 15 columns, so `col` must stay within 4 to 31.

- [ ] **Step 6: Run the whole suite and commit**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 224`, `# fail 0`

```bash
git add slice/attract.js test/attract.test.js
git commit -m "Add the attract screen with its idle countdown and keep-alive"
```

---

### Task 3: Pages clean up on cancellation

**Files:**
- Modify: `slice/photobooth.js`
- Modify: `slice/venables.js`
- Test: `test/photobooth.test.js`

**Interfaces:**
- Consumes: `IdleError` from Task 1.

- [ ] **Step 1: Write the failing test**

Extend the stub Minitel in `test/photobooth.test.js` so a pending key read can be rejected: declare `let pendingReject = null;` beside `let pending = null;`, make `key()` keep the reject by replacing `const char = await new Promise((resolve) => { pending = resolve; });` with `const char = await new Promise((resolve, reject) => { pending = resolve; pendingReject = reject; });`, and add next to `press(char)`:

```js
    fail(error) { if (pending) { const r = pendingReject; pending = null; pendingReject = null; r(error); } },
```

Import `IdleError` from `../minitel.js` at the top, then append:

```js
test("cancellation while waiting for a key propagates and clears the notification timer", async () => {
  const { m, run } = harness(["x"]);
  const pending = run();
  await new Promise((r) => setTimeout(r, 20));
  m.fail(new IdleError());
  await assert.rejects(Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error("hung")), 500))]), IdleError);
  const before = m.calls.length;
  await new Promise((r) => setTimeout(r, 2200));
  assert.equal(m.calls.length, before, "the erase timer was cleared on cancellation");
});
```

The "x" key schedules the two-second erase timer before the cancellation lands; without the `finally` its `pos` and `plot` calls arrive after the rejection.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/photobooth.test.js`
Expected: FAIL with `the erase timer was cleared on cancellation`

- [ ] **Step 3: Implement**

In `slice/photobooth.js`, wrap the key loop:

```js
    try {
      while (true) {
        ...unchanged loop body...
      }
    } finally {
      clearTimeout(erase);
    }
    return lastKey;
```

(The existing `clearTimeout(erase)` after the loop moves into the `finally`; `break` inside the loop still reaches `return lastKey`.)

In `slice/venables.js`, in `venablesVibes`:

```js
    const stopMarquee = startMarquee(m, page);
    let char, key;
    try {
      [char, key] = await m.key();
    } finally {
      stopMarquee();
    }
```

replacing the three lines `const stopMarquee = ...; const [char, key] = await m.key(); stopMarquee();`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/photobooth.test.js test/venables.test.js`
Expected: PASS

- [ ] **Step 5: Run the whole suite and commit**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 225`, `# fail 0`

```bash
git add slice/photobooth.js slice/venables.js test/photobooth.test.js
git commit -m "Photobooth and Venables pages clear their timers when a key read is cancelled"
```

---

### Task 4: Welcome loop runs the attract screen; docs

**Files:**
- Modify: `index.js`
- Modify: `README.md`, `.env.example`

**Interfaces:**
- Consumes: `IdleError`, `idleConfig` (Task 1), `startIdle`, `runAttract` (Task 2).

- [ ] **Step 1: Wire `index.js`**

Imports:

```js
import { Minitel, IdleError } from "./minitel.js";
import { startIdle, runAttract } from "./slice/attract.js";
import { programsFor } from "./slice/menu.js";
import { terminalToken, idleConfig } from "./config.js";
```

After `const config = photoboothConfig();`:

```js
const idle = idleConfig();
```

In `welcomePage`, after `const programs = ...`:

```js
  const watch = () => startIdle(m, { ...idle, onIdle: () => m.cancelRead(new IdleError()) });
  let watchdog = watch();
  websocket.on("close", () => watchdog.stop());
```

Wrap the body of `while (true) {` in the loop:

```js
  while (true) {
    try {
      ...the existing prompt, input, hand-off and invalid-option code, unchanged...
    } catch (error) {
      if (!(error instanceof IdleError)) throw error;
      logger.info("Idle: attract screen");
      watchdog.stop();
      await runAttract(m);
      watchdog = watch();
      await displayWelcome();
    }
  }
```

Startup log, next to the terminal-token line:

```js
  logger.info(`Attract screen after ${idle.idleMs / 1000} s idle, keep-alive every ${idle.keepaliveMs / 1000} s`);
```

- [ ] **Step 2: Probe the wake path against a running server**

Port 3615 must be free (the user's dev server stopped). Run:

```bash
IDLE_SECONDS=3 KEEPALIVE_SECONDS=1 node --env-file-if-exists=.env index.js > /tmp/attract-run.log 2>&1 &
sleep 3
node -e '
import("ws").then(({ default: WebSocket }) => {
  const ws = new WebSocket("ws://localhost:3615");
  const frames = [];
  let s = "";
  ws.on("message", (d) => { const t = d.toString("latin1"); s += t; if (/press any key/.test(t)) frames.push(Date.now()); if (t === "\x00") frames.push("nul"); });
  setTimeout(() => { console.log("keep-alives before idle:", frames.filter((f) => f === "nul").length); }, 2500);
  setTimeout(() => { console.log("attract frames by 9 s:", frames.filter((f) => f !== "nul").length); s = ""; ws.send("x"); }, 9000);
  setTimeout(() => { console.log("welcome back:", /select an option/.test(s), "attract again:", /press any key/.test(s)); ws.close(); }, 11000);
});'
kill %1
grep -c "Idle: attract screen" /tmp/attract-run.log; grep -i -c "error" /tmp/attract-run.log
```

Expected: `keep-alives before idle: 2` (or 1 to 3), `attract frames by 9 s: 2` (frames at 3 s and 8 s), `welcome back: true attract again: false`, one "Idle: attract screen" line, zero errors. Then a second probe that closes the socket while the attract screen is showing (send nothing, close at 5 s) and check the log still has no error and the process keeps running for another 10 s.

- [ ] **Step 3: Docs**

`.env.example`, after the `PHOTOBOOTH_*` block:

```
# Idle behaviour: seconds without a key before the animated "press any key" screen (the Minitel 1B
# blanks itself after four to five minutes, keep this below), and the interval of the keep-alive
# byte sent while a page is in use (0 disables it).
#IDLE_SECONDS=180
#KEEPALIVE_SECONDS=30
```

README configuration table, two rows:

```markdown
| `IDLE_SECONDS` | `180`. Seconds without a key before the attract screen; keep it under the terminal's own standby of four to five minutes |
| `KEEPALIVE_SECONDS` | `30`. Interval of the ignored byte sent while a page is in use so the terminal never blanks; `0` disables it |
```

And a short paragraph under the table:

```markdown
A Minitel 1B turns its screen off after four to five minutes without received data or a key press. After `IDLE_SECONDS` without a key the server abandons the current page and shows an animated "press any key" screen, which also keeps the terminal awake; any key returns to the welcome page. While a page is in use a NUL goes out every `KEEPALIVE_SECONDS` so the screen stays on.
```

- [ ] **Step 4: Run the whole suite and commit**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 225`, `# fail 0`

```bash
git add index.js README.md .env.example
git commit -m "Welcome loop shows the attract screen after IDLE_SECONDS and keeps the terminal awake"
```

---

### Task 5: Hardware check of the keep-alive byte and deployment

**Files:** none. With the user, when the gallery is quiet.

- [ ] **Step 1: Deploy**

```bash
git push
ssh minitelpi.local 'cd ~/code/3615-UCODIA && git pull --ff-only && sudo systemctl restart slice && sleep 3 && journalctl -u slice -n 3 --no-pager -o cat'
```

Expected: the log shows `Attract screen after 180 s idle, keep-alive every 30 s`.

- [ ] **Step 2: Keep-alive check**

Set `IDLE_SECONDS=900` in the Pi's `.env`, restart, leave the Minitel on the welcome page untouched for six minutes. Expected: the screen stays on. Then `KEEPALIVE_SECONDS=0`, restart, wait again. Expected: the screen blanks after the terminal's own delay. Restore `IDLE_SECONDS=180`, remove `KEEPALIVE_SECONDS`, restart. If the screen blanked with the keep-alive on, NUL is not counted as activity by this terminal: change the default byte in `startIdle` to the status-row hint redraw (`"\x1f\x40\x41"` followed by the hint text is idempotent) and repeat.

- [ ] **Step 3: Attract check**

Leave the terminal untouched for three minutes. Expected: the smiley appears and moves every five seconds. Press a key. Expected: the welcome page, and no attract frame for the next three minutes while keys are pressed now and then. Try it once from inside the photobooth after a capture, to see the page abandoned and the welcome page after the wake.

- [ ] **Step 4: Log the outcome in the meta-repo execution log.**
