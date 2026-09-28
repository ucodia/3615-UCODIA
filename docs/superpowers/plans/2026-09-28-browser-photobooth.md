# Browser Photobooth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web visitors on the emulator get the photobooth with their own browser camera, while the server webcam stays unreachable from public connections and the server never decodes visitor bytes.

**Architecture:** The websocket keeps text for the terminal and adds binary for the photobooth: three one-byte control messages down (camera on, capture, camera off), one raw 320×240 RGB frame or an empty message up. A `BrowserCamera` with the webcam's `capture()` shape is injected into a second photobooth entry offered to public connections only. The image pipeline enters sharp with a raw descriptor, so no decoder runs on visitor data.

**Tech Stack:** Node 22 ESM, `ws` 8, `sharp` 0.34, `node --test`. Browser side: getUserMedia and canvas in the emulator's plain script.

**Spec:** `docs/superpowers/specs/2026-09-28-browser-photobooth-design.md`

## Global Constraints

- Node 22.9 or later; no new dependencies.
- ESM throughout; tests run with `npm test` (`node --test`), currently 231 passing.
- Text websocket frames are the terminal, binary frames are the photobooth. The ESP32 path and the terminal photobooth are unchanged.
- The frame is exactly `320 × 240 × 3 = 230400` bytes of RGB, unmirrored; the server mirrors.
- The websocket server payload cap is `512 * 1024` bytes.
- Public photobooth: gamma 1, no dump. Control bytes: `0x01` camera on, `0x02` capture, `0x03` camera off.
- Commit messages are concise and precise, no co-author, no session links. No code comments unless the logic needs one.

## Review Focus

1. A binary frame sent by a client when no capture is pending must be dropped, not held for the next capture. Test in Task 3.
2. A binary frame whose bytes spell a key sequence must never reach the key reader. Test in Task 1.
3. A capture whose socket closes mid-way must reject by the timeout and not hang the page. Test in Task 3 (timeout); the page's own reads then fail with `ClosedError` as today.
4. An ESP32 connecting without its token now receives the public photobooth and its control bytes as binary frames; the sketch handles only text events, so the bytes are ignored and the capture times out to "camera not available". No test; noted in the README security paragraph.
5. Entries without a `terminal` flag must reach both audiences after the flag change. Test in Task 5.

---

### Task 1: The key reader ignores binary messages

**Files:**
- Modify: `minitel.js:118` (the `onmessage` inside `#read`)
- Test: `test/minitel-read.test.js`

**Interfaces:**
- Consumes: `fakeSocket()` in the test file, whose `deliver(data)` calls both the `message` handler and `onmessage`.
- Produces: nothing new; `key()` skips non-string messages.

- [ ] **Step 1: Write the failing tests**

Append to `test/minitel-read.test.js`:

```js
test("a binary message that spells a key sequence is not read as a key", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const next = m.key();
  ws.deliver(Buffer.from("\x13F"));
  ws.deliver("b");
  assert.deepEqual(await within(next), ["b", 0]);
});

test("a binary message counts as activity", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const before = m.lastActivity;
  await new Promise((r) => setTimeout(r, 5));
  ws.deliver(Buffer.alloc(3));
  assert.ok(m.lastActivity > before);
});
```

- [ ] **Step 2: Run them**

Run: `node --test test/minitel-read.test.js`
Expected: the first new test FAILS with `["", 6]` instead of `["b", 0]` (the buffer bytes were read as Sommaire); the second PASSES already.

- [ ] **Step 3: Skip non-strings in the reader**

In `minitel.js`, replace the line

```js
          this.ws.onmessage = (event) => resolve(event.data);
```

with

```js
          this.ws.onmessage = (event) => { if (typeof event.data === "string") resolve(event.data); };
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/minitel-read.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add minitel.js test/minitel-read.test.js
git commit -m "Key reader ignores binary websocket messages"
```

---

### Task 2: prepare accepts raw pixels

**Files:**
- Modify: `image/prepare.js:6-10`
- Test: `test/prepare.test.js`

**Interfaces:**
- Consumes: `prepare(source, cols, rows, options)` as today.
- Produces: `source` may be `{ data: Buffer, raw: { width, height, channels } }`; later tasks pass this shape from `BrowserCamera`.

- [ ] **Step 1: Write the failing test**

Append to `test/prepare.test.js`:

```js
test("prepare takes raw pixels tagged with their geometry and matches the same image encoded", async () => {
  const width = 320, height = 240;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      data[i] = Math.round((x / 319) * 255);
      data[i + 1] = Math.round((y / 239) * 255);
      data[i + 2] = 128;
    }
  const encoded = await sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const a = await prepare({ data, raw: { width, height, channels: 3 } }, 40, 24, { mirror: true });
  const b = await prepare(encoded, 40, 24, { mirror: true });
  assert.deepEqual(Array.from(a.data), Array.from(b.data));
});
```

- [ ] **Step 2: Run it**

Run: `node --test test/prepare.test.js`
Expected: FAIL, sharp rejects the plain object as input (`Unsupported input`).

- [ ] **Step 3: Accept the tagged form**

In `image/prepare.js`, replace

```js
  let pipeline = sharp(source, { limitInputPixels: maxPixels }).flatten({ background: "#000000" });
```

with

```js
  const input = source.raw ? sharp(source.data, { raw: source.raw }) : sharp(source, { limitInputPixels: maxPixels });
  let pipeline = input.flatten({ background: "#000000" });
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/prepare.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add image/prepare.js test/prepare.test.js
git commit -m "prepare accepts raw pixels tagged with their geometry"
```

---

### Task 3: BrowserCamera

**Files:**
- Create: `photobooth/browser-camera.js`
- Test: `test/browser-camera.test.js`

**Interfaces:**
- Consumes: a `ws` server socket: `send(data)`, `on("message", (data, isBinary) => {})`.
- Produces: `BrowserCamera({ websocket, timeoutMs = 10000, width = 320, height = 240 })` with `open()`, `close()`, `capture(): Promise<{ data: Buffer, raw: { width, height, channels: 3 } }>`; exported constants `CAMERA_ON = 1`, `CAPTURE = 2`, `CAMERA_OFF = 3`.

- [ ] **Step 1: Write the failing tests**

Create `test/browser-camera.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { BrowserCamera, CAMERA_ON, CAPTURE, CAMERA_OFF } from "../photobooth/browser-camera.js";

const FRAME = 320 * 240 * 3;

function fakeSocket() {
  const ws = { sent: [], handlers: {} };
  ws.send = (data) => { ws.sent.push(Buffer.from(data)); };
  ws.on = (event, fn) => { ws.handlers[event] = fn; };
  ws.deliver = (data, isBinary = true) => { ws.handlers.message?.(data, isBinary); };
  return ws;
}
const bytes = (ws) => ws.sent.map((b) => Array.from(b));

test("open and close send their control byte", () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  camera.open();
  camera.close();
  assert.deepEqual(bytes(ws), [[CAMERA_ON], [CAMERA_OFF]]);
});

test("capture sends the capture byte and resolves with a tagged frame", async () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  const pending = camera.capture();
  assert.deepEqual(bytes(ws), [[CAPTURE]]);
  ws.deliver(Buffer.alloc(FRAME, 7));
  const frame = await pending;
  assert.equal(frame.data.length, FRAME);
  assert.equal(frame.data[0], 7);
  assert.deepEqual(frame.raw, { width: 320, height: 240, channels: 3 });
});

test("an empty message means no camera", async () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  const pending = camera.capture();
  ws.deliver(Buffer.alloc(0));
  await assert.rejects(pending, /no camera/);
});

test("a frame of the wrong length is refused", async () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  const pending = camera.capture();
  ws.deliver(Buffer.alloc(FRAME - 1));
  await assert.rejects(pending, /bad frame/);
});

test("capture times out", async () => {
  const camera = new BrowserCamera({ websocket: fakeSocket(), timeoutMs: 20 });
  await assert.rejects(camera.capture(), /camera timeout/);
});

test("text during a capture is ignored, a frame with no capture pending is dropped", async () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  ws.deliver(Buffer.alloc(FRAME));
  const pending = camera.capture();
  ws.deliver("x", false);
  let settled = false;
  pending.then(() => { settled = true; }, () => { settled = true; });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(settled, false);
  ws.deliver(Buffer.alloc(FRAME));
  await pending;
});

test("one capture at a time, and the next one works after an outcome", async () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  const first = camera.capture();
  await assert.rejects(camera.capture(), /in progress/);
  ws.deliver(Buffer.alloc(0));
  await assert.rejects(first, /no camera/);
  const second = camera.capture();
  ws.deliver(Buffer.alloc(FRAME));
  await second;
});
```

- [ ] **Step 2: Run them**

Run: `node --test test/browser-camera.test.js`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the class**

Create `photobooth/browser-camera.js`:

```js
export const CAMERA_ON = 1;
export const CAPTURE = 2;
export const CAMERA_OFF = 3;

// The visitor's browser camera: control bytes go down, one raw RGB frame comes back.
export class BrowserCamera {
  #pending = null;

  constructor({ websocket, timeoutMs = 10000, width = 320, height = 240 }) {
    this.ws = websocket;
    this.timeoutMs = timeoutMs;
    this.width = width;
    this.height = height;
    websocket.on("message", (data, isBinary) => {
      if (isBinary && this.#pending) this.#pending(data);
    });
  }

  open() {
    this.#control(CAMERA_ON);
  }

  close() {
    this.#control(CAMERA_OFF);
  }

  #control(byte) {
    this.ws.send(Buffer.from([byte]));
  }

  capture() {
    if (this.#pending) return Promise.reject(new Error("capture in progress"));
    const expected = this.width * this.height * 3;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending = null;
        reject(new Error("camera timeout"));
      }, this.timeoutMs);
      this.#pending = (data) => {
        clearTimeout(timer);
        this.#pending = null;
        if (data.length === 0) reject(new Error("no camera"));
        else if (data.length !== expected) reject(new Error(`bad frame: ${data.length} bytes`));
        else resolve({ data: Buffer.from(data), raw: { width: this.width, height: this.height, channels: 3 } });
      };
      this.#control(CAPTURE);
    });
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/browser-camera.test.js`
Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add photobooth/browser-camera.js test/browser-camera.test.js
git commit -m "BrowserCamera: capture a raw frame from the emulator over the websocket"
```

---

### Task 4: The photobooth page opens and closes the camera and hashes tagged frames

**Files:**
- Modify: `slice/photobooth.js:29-31` (`hashOf`), `:143` (after `await show(renderIdle())`), `:161-163` (`finally`)
- Test: `test/photobooth.test.js`

**Interfaces:**
- Consumes: `camera.open?.()`, `camera.close?.()`, `capture()` resolving with a Buffer or `{ data, raw }`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing tests**

Append to `test/photobooth.test.js`:

```js
test("hashOf hashes the pixels of a tagged frame", () => {
  const data = Buffer.from("pixels");
  assert.equal(hashOf({ data, raw: { width: 1, height: 2, channels: 3 } }), hashOf(data));
});

test("the page opens the camera once the idle screen shows and closes it on exit", async () => {
  const { m, camera, run } = harness([6]);
  camera.open = () => m.calls.push(["camera", "open"]);
  camera.close = () => m.calls.push(["camera", "close"]);
  await run();
  const idle = m.calls.findIndex((c) => c[0] === "send" && c[1] === encode(renderIdle()));
  const open = m.calls.findIndex((c) => c[0] === "camera" && c[1] === "open");
  assert.ok(idle >= 0 && open > idle, "open comes after the idle screen");
  assert.deepEqual(m.calls.at(-1), ["camera", "close"]);
});

test("the camera is closed when the key read is cancelled", async () => {
  const { m, camera, run } = harness([]);
  let closed = 0;
  camera.close = () => { closed++; };
  const pending = run();
  await new Promise((r) => setTimeout(r, 5));
  m.fail(new IdleError());
  await assert.rejects(Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error("hung")), 500))]), IdleError);
  assert.equal(closed, 1);
});
```

- [ ] **Step 2: Run them**

Run: `node --test test/photobooth.test.js`
Expected: the three new tests FAIL (`hashOf` throws on an object; no `camera` calls recorded; `closed` is 0). Every existing test still passes.

- [ ] **Step 3: Implement**

In `slice/photobooth.js`, change `hashOf`:

```js
export function hashOf(source) {
  return createHash("sha256").update(source.data ?? source).digest("hex").slice(0, 7);
}
```

After the line `await show(renderIdle());` that precedes the `try { while (true) {` loop, add:

```js
    camera.open?.();
```

In the `finally` of that loop, after `clearTimeout(erase);`, add:

```js
      camera.close?.();
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/photobooth.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add slice/photobooth.js test/photobooth.test.js
git commit -m "Photobooth page opens and closes its camera, hashes tagged frames"
```

---

### Task 5: Menu entries carry a terminal flag

**Files:**
- Modify: `slice/menu.js`
- Test: `test/menu.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `programsFor(programs, { terminal })` keeps entries whose `terminal` flag is absent or equals the connection's; `terminalOnly` is gone. Task 6 sets the flags.

- [ ] **Step 1: Rewrite the tests**

Replace the body of `test/menu.test.js` with:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { programsFor } from "../slice/menu.js";

const programs = [
  { key: "1", title: "calendar" },
  { key: "P", title: "photobooth", terminal: true, camera: "webcam" },
  { key: "P", title: "photobooth", terminal: false, camera: "browser" },
];

test("programsFor gives the terminal its photobooth and the shared entries", () => {
  const list = programsFor(programs, { terminal: true });
  assert.deepEqual(list.map((p) => p.key), ["1", "P"]);
  assert.equal(list[1].camera, "webcam");
});

test("programsFor gives public connections the browser photobooth and the shared entries", () => {
  for (const options of [{ terminal: false }, {}]) {
    const list = programsFor(programs, options);
    assert.deepEqual(list.map((p) => p.key), ["1", "P"]);
    assert.equal(list[1].camera, "browser");
  }
});
```

- [ ] **Step 2: Run them**

Run: `node --test test/menu.test.js`
Expected: FAIL, both lists contain two `P` entries.

- [ ] **Step 3: Implement**

Replace `slice/menu.js` with:

```js
export function programsFor(programs, { terminal = false } = {}) {
  return programs.filter((program) => program.terminal === undefined || program.terminal === terminal);
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/menu.test.js`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add slice/menu.js test/menu.test.js
git commit -m "Menu entries select their audience with a terminal flag"
```

---

### Task 6: Program list module with the public photobooth, payload cap

**Files:**
- Create: `slice/programs.js`
- Modify: `index.js:4-8,11,33-39`, `server.js:44`
- Test: `test/programs.test.js` (new), `test/server-auth.test.js`

**Interfaces:**
- Consumes: `createPhotobooth`, `BrowserCamera` (Task 3), `programsFor` (Task 5).
- Produces: `buildPrograms({ camera, store, config, dump = null, makeBrowserCamera })` returning the program array; `MAX_PAYLOAD` in `server.js`.

- [ ] **Step 1: Write the failing tests**

Create `test/programs.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrograms } from "../slice/programs.js";
import { programsFor } from "../slice/menu.js";

function fakeSocket() {
  const ws = { sent: [], handlers: {}, onmessage: null };
  ws.send = async (data) => { ws.sent.push(data); };
  ws.on = (event, fn) => { ws.handlers[event] = fn; };
  ws.deliver = (data) => { ws.handlers.message?.(data, false); ws.onmessage?.({ data }); };
  return ws;
}
const within = (promise, ms = 500) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("hung")), ms))]);
const config = { publicUrl: "https://slice.example.com", ttl: 300, gamma: 1 };
const webcam = { capture: async () => assert.fail("webcam reached from a public connection") };
const store = { publish: async () => assert.fail("nothing is published in these tests") };

test("public connections get a photobooth built on a browser camera for their socket", async () => {
  const made = [];
  const makeBrowserCamera = (ws) => { made.push(ws); return { capture: async () => assert.fail("no capture here") }; };
  const programs = programsFor(buildPrograms({ camera: webcam, store, config, makeBrowserCamera }), { terminal: false });
  const entries = programs.filter((p) => p.key === "P");
  assert.equal(entries.length, 1);
  const ws = fakeSocket();
  const page = entries[0].handoff(ws);
  await new Promise((r) => setTimeout(r, 5));
  ws.deliver("\x13F");
  assert.equal(await within(page), 6);
  assert.deepEqual(made, [ws]);
});

test("the terminal gets one photobooth and no browser camera is ever made for it", () => {
  const programs = programsFor(buildPrograms({ camera: webcam, store, config, makeBrowserCamera: () => assert.fail("browser camera for the terminal") }), { terminal: true });
  const entries = programs.filter((p) => p.key === "P");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].terminal, true);
});

test("every audience sees the four shared entries", () => {
  for (const terminal of [true, false]) {
    const keys = programsFor(buildPrograms({ camera: webcam, store, config }), { terminal }).map((p) => p.key);
    assert.deepEqual(keys, ["1", "2", "3", "V", "P"]);
  }
});
```

Append to `test/server-auth.test.js`:

```js
test("a message above the payload cap closes the connection with 1009", async () => {
  await withServer(null, async (url) => {
    const ws = new WebSocket(url);
    await once(ws, "open");
    ws.send(Buffer.alloc(600 * 1024));
    const [code] = await once(ws, "close");
    assert.equal(code, 1009);
  });
});
```

- [ ] **Step 2: Run them**

Run: `node --test test/programs.test.js test/server-auth.test.js`
Expected: `programs.test.js` FAILS, module missing; the payload test FAILS, the close never comes within the test's default timeout or the code is 1005.

- [ ] **Step 3: Create the program list module**

Create `slice/programs.js`:

```js
import { sliceSchedule } from "./schedule.js";
import { omeletteFacts } from "./omelette.js";
import { venablesVibes } from "./venables.js";
import { createPhotobooth } from "./photobooth.js";
import { BrowserCamera } from "../photobooth/browser-camera.js";

export function buildPrograms({ camera, store, config, dump = null, makeBrowserCamera = (ws) => new BrowserCamera({ websocket: ws }) }) {
  const shared = { store, publicUrl: config.publicUrl, ttl: config.ttl };
  return [
    { key: "1", title: "exhibits calendar", handoff: (ws) => sliceSchedule(ws, "exhibits") },
    { key: "2", title: "workshops calendar", handoff: (ws) => sliceSchedule(ws, "workshops") },
    { key: "3", title: "omelette facts", handoff: omeletteFacts },
    { key: "V", title: "venables vibes", handoff: venablesVibes },
    { key: "P", title: "photobooth", terminal: true, handoff: createPhotobooth({ ...shared, camera, gamma: config.gamma, dump }) },
    { key: "P", title: "photobooth", terminal: false, handoff: (ws) => createPhotobooth({ ...shared, camera: makeBrowserCamera(ws) })(ws) },
  ];
}
```

- [ ] **Step 4: Use it from index.js**

In `index.js`, remove the imports of `sliceSchedule`, `omeletteFacts`, `venablesVibes` and `createPhotobooth`, add

```js
import { buildPrograms } from "./slice/programs.js";
```

and replace the `const allPrograms = [ ... ];` block with

```js
const allPrograms = buildPrograms({ camera, store: photoStore, config, dump });
```

- [ ] **Step 5: Cap the payload**

In `server.js`, add near the top

```js
const MAX_PAYLOAD = 512 * 1024;
```

and change the server construction to

```js
  const wss = new WebSocketServer({ server, handleProtocols: selectProtocol(terminalToken), maxPayload: MAX_PAYLOAD });
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: all PASS, 231 + 12 new = 243 or more, none failing.

- [ ] **Step 7: Start the server and check the menu**

Run: `npm start` in one shell, in another:

```bash
node -e '
const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:3615");
let out = "";
ws.on("message", (d) => { out += d.toString(); });
setTimeout(() => { console.log(/photobooth/.test(out) ? "P offered" : "P missing"); ws.terminate(); }, 1500);'
```

Expected: `P offered`. Stop the server afterwards (the user runs their own on 3615).

- [ ] **Step 8: Commit**

```bash
git add slice/programs.js index.js server.js test/programs.test.js test/server-auth.test.js
git commit -m "Public connections get the photobooth on a browser camera; 512 KB websocket payload cap"
```

---

### Task 7: Emulator camera support

**Files:**
- Modify: `emulator/library/minitel.js:4661` (the `Minitel.Emulator` class), `:4769` (`onmessage`), `:4788` (`onclose`)

**Interfaces:**
- Consumes: the control bytes of Task 3.
- Produces: nothing for other tasks; checked by hand.

- [ ] **Step 1: Branch binary messages**

In the `Minitel.Emulator` constructor, replace

```js
        this.socket.onmessage = (messageEvent) => {
          const message = [];
```

with

```js
        this.socket.onmessage = (messageEvent) => {
          if (messageEvent.data instanceof Blob) {
            this.photobooth(messageEvent.data);
            return;
          }
          const message = [];
```

and in `onclose`, after `this.vdu.setStatusCharacter(0x46);`, add

```js
        this.cameraOff();
```

- [ ] **Step 2: Add the camera methods**

Inside `Minitel.Emulator = class { ... }`, after the constructor, add:

```js
  // Photobooth control bytes from the server: 1 camera on, 2 capture, 3 camera off.
  async photobooth(blob) {
    const [byte] = new Uint8Array(await blob.arrayBuffer());
    if (byte === 1) await this.cameraOn();
    else if (byte === 2) this.socket.send(this.frame());
    else if (byte === 3) this.cameraOff();
  }

  async cameraOn() {
    if (this.camera) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      this.camera = { stream, video };
    } catch (error) {
      this.camera = undefined;
    }
  }

  // 320 by 240 RGB, centre cover crop, not mirrored: the server mirrors.
  frame() {
    const video = this.camera?.video;
    if (!video || !video.videoWidth) return new Uint8Array(0);
    const width = 320;
    const height = 240;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
    const sw = width / scale;
    const sh = height / scale;
    ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i];
      rgb[j + 1] = data[i + 1];
      rgb[j + 2] = data[i + 2];
    }
    return rgb;
  }

  cameraOff() {
    if (!this.camera) return;
    this.camera.stream.getTracks().forEach((track) => track.stop());
    this.camera.video.srcObject = null;
    this.camera = undefined;
  }
```

- [ ] **Step 3: Syntax check**

Run: `node --check emulator/library/minitel.js`
Expected: no output.

- [ ] **Step 4: Check by hand in the browser**

Run: `npm start`, open `http://localhost:3615` in Chrome, and walk through:

1. Press `P`: the browser asks for the camera. Allow. The idle screen shows PHOTOBOOTH and the space prompt.
2. Press space: 3, 2, 1, then your picture in the poster look, mirrored like a mirror.
3. Press `F` six times: every look, back to poster.
4. Press `D`: the QR page with the download url; a phone scanning it gets the PNG.
5. Press SOMMAIRE (the emulator's key for it): the menu returns and the browser's camera indicator goes out.
6. Reload, press `P`, refuse the camera, press space: the countdown runs, then "camera not available" on the status row and the idle screen.
7. Open `http://localhost:3615/?token=<TERMINAL_TOKEN>` from `.env`, press `P` and space: the server webcam is used, no browser prompt.

Expected: all seven as described. Stop the server afterwards.

- [ ] **Step 5: Commit**

```bash
git add emulator/library/minitel.js
git commit -m "Emulator answers the photobooth control bytes with a browser camera frame"
```

---

### Task 8: README

**Files:**
- Modify: `README.md:64` ("Who gets what"), `:66-68` (Photobooth)

- [ ] **Step 1: Update "Who gets what"**

Replace the sentence "A websocket connection presenting `TERMINAL_TOKEN` is the gallery terminal and is the only one offered the photobooth, so the webcam next to the Minitel can only be triggered from the Minitel. Everyone else sees the menu without it." with:

"A websocket connection presenting `TERMINAL_TOKEN` is the gallery terminal and the only one whose photobooth uses the server webcam, so the camera next to the Minitel can only be triggered from the Minitel. Everyone else gets the photobooth on their own browser camera: the emulator sends a 320 by 240 block of raw pixels, which the server checks by length and never decodes, so no image parser ever runs on visitor data. Websocket messages are capped at 512 KB."

- [ ] **Step 2: Update the Photobooth section**

After the first paragraph of the Photobooth section (the one starting "Menu key `P`."), add:

"On the browser emulator the picture comes from the visitor's camera. The browser asks for permission when the photobooth page opens; a refusal or a missing camera shows "camera not available" after the countdown. The camera is released when the page is left."

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "README: photobooth for web visitors on their own camera"
```

---

## Self-review

- Spec coverage: wire protocol (Tasks 3, 7), server side (1, 2, 3, 4, 6), emulator (7), isolation test (6), payload cap (6), docs (8). Non-goals untouched.
- Types: `capture()` resolves with `{ data, raw }` in Task 3; `hashOf` and `prepare` accept it in Tasks 4 and 2; `convertAll` passes the source through unchanged, so no task edits it.
- `programsFor` in Task 5 is consumed by Task 6 with `terminal: true | false`.
- Review Focus items 1, 2, 3 and 5 have tests in Tasks 3, 1, 3 and 5; item 4 is documented, not tested.
