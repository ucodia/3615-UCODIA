# Photobooth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Minitel photobooth page: server-side webcam capture through ffmpeg, all looks converted at once, F to cycle, D to publish a Minitel-look PNG behind a QR code for five minutes.

**Architecture:** Four new units with injected dependencies so the page is testable without hardware: `photobooth/camera.js` (ffmpeg spawn, mode probing, a queue), `photobooth/store.js` (files under `data/photobooth` with expiry), `image/render.js` (cells to PNG through the emulator sprites), `slice/photobooth-screens.js` (pure Screen builders) and `slice/photobooth.js` (the key loop). `server.js` serves published files; `index.js` registers the page on `P`.

**Tech Stack:** Node 22 ESM, `node:test`, `ffmpeg-static`, sharp, `qrcode`, the existing `Screen`/`encode`, `Minitel` class.

**Spec:** `docs/superpowers/specs/2026-09-27-photobooth-design.md`.

## Global Constraints

- ESM, two-space indent, double quotes, semicolons. Suite must stay green (136 now). Commit per task, no attribution lines.
- Cells: mosaic `{ bits, fg, bg }`, text `{ char, fg, bg }`, as produced by `image/pipeline.js` `toCells`.
- Filter order: `["poster", "photo", "halftone", "smooth", "newsprint", "stripes", "sketch", "stencil", "typewriter"]`.
- File names: `/^[0-9a-f]{8}-[a-z]+\.png$/`; hash = first 8 hex chars of SHA-256 of the JPEG.
- Picture is 40 by 24 at row 1, col 1. Bar is row 24. Notifications on row 0 via `m.message(0, col, seconds, text, true)`.
- Env: `PHOTOBOOTH_DEVICE`, `PHOTOBOOTH_FFMPEG`, `PUBLIC_URL` (default `http://localhost:3615`), `PHOTOBOOTH_TTL` (default 300).

## Review Focus

1. A malformed download name such as `../server.js` or `abc.png` must 404 without touching the file system; pinned in Task 3 (store name validation) and Task 4 (route).
2. Pressing SPACE while a capture is running must be ignored, not queue a second shot; pinned in Task 6 (`space during capture is ignored`).
3. Pressing D before any capture must do nothing but the hint; pinned in Task 6 (`d before capture shows the hint`).
4. A capture failure must return to idle with a message and leave the page usable; pinned in Task 6 (`capture failure shows a message and stays idle`).
5. Publishing the same hash and filter twice must not re-render or rewrite, only refresh expiry; pinned in Task 3 (`re-publish refreshes expiry without rewriting`) and Task 6 (`d twice renders once`).

---

### Task 1: PNG renderer from cells

**Files:** Create `image/render.js`; Test `test/render.test.js`.

**Interfaces:** `renderPng(cells, { scale = 4 }) -> Promise<Buffer>` PNG, greyscale, `cols*8*scale` by `rows*10*scale`; `loadSprites()` cached.

- [ ] **Step 1: Failing tests**
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { renderPng } from "../image/render.js";

async function pixels(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

test("renderPng sizes the image by cells and scale", async () => {
  const png = await renderPng([[{ bits: 0, fg: 0, bg: 0 }, { bits: 0, fg: 0, bg: 0 }]], { scale: 2 });
  const p = await pixels(png);
  assert.equal(p.width, 32);
  assert.equal(p.height, 20);
});

test("renderPng draws a mosaic subpixel with the foreground grey", async () => {
  const png = await renderPng([[{ bits: 1, fg: 7, bg: 4 }]], { scale: 1 });
  const p = await pixels(png);
  const at = (x, y) => p.data[(y * p.width + x) * p.channels];
  assert.equal(at(0, 0), 255);
  assert.equal(at(3, 2), 255);
  assert.equal(at(4, 0), 102); // 0.4 * 255
  assert.equal(at(0, 3), 102);
});

test("renderPng draws text glyphs from the G0 sheet", async () => {
  const png = await renderPng([[{ char: "A", fg: 7, bg: 0 }]], { scale: 1 });
  const p = await pixels(png);
  const at = (x, y) => p.data[(y * p.width + x) * p.channels];
  assert.equal(at(2, 1), 255);
  assert.equal(at(3, 1), 255);
  assert.equal(at(0, 1), 0);
  assert.equal(at(1, 2), 255);
});
```
- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3: Implement**
```js
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LEVELS } from "./levels.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let sprites = null;

async function sheet(name) {
  const { data, info } = await sharp(join(root, "emulator/font", `${name}.png`)).raw().toBuffer({ resolveWithObject: true });
  const glyphs = [];
  for (let ord = 0; ord < 128; ord++) {
    const x0 = Math.floor(ord / 16) * 8;
    const y0 = (ord % 16) * 10;
    const bits = new Uint8Array(80);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 8; x++) {
        const o = ((y0 + y) * info.width + x0 + x) * info.channels;
        const opaque = info.channels < 4 || data[o + 3] > 0;
        bits[y * 8 + x] = opaque && data[o] > 127 ? 1 : 0;
      }
    }
    glyphs.push(bits);
  }
  return glyphs;
}

export async function loadSprites() {
  if (!sprites) sprites = { text: await sheet("ef9345-g0"), mosaic: await sheet("ef9345-g1") };
  return sprites;
}

// Cells to a greyscale PNG using the emulator's own glyph shapes.
export async function renderPng(cells, { scale = 4 } = {}) {
  const { text, mosaic } = await loadSprites();
  const rows = cells.length;
  const cols = cells[0].length;
  const width = cols * 8 * scale;
  const height = rows * 10 * scale;
  const buf = Buffer.alloc(width * height);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const cell = cells[cy][cx];
      const glyph = "char" in cell ? text[cell.char.charCodeAt(0)] : mosaic[0x40 + cell.bits];
      const fg = Math.round(LEVELS[cell.fg] * 255);
      const bg = Math.round(LEVELS[cell.bg] * 255);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 8; x++) {
          const v = glyph[y * 8 + x] ? fg : bg;
          for (let sy = 0; sy < scale; sy++) {
            const row = (cy * 10 + y) * scale + sy;
            buf.fill(v, row * width + (cx * 8 + x) * scale, row * width + (cx * 8 + x + 1) * scale);
          }
        }
      }
    }
  }
  return sharp(buf, { raw: { width, height, channels: 1 } }).png().toBuffer();
}
```
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `Add PNG renderer from cells using the emulator sprites`.

---

### Task 2: Camera

**Files:** Create `photobooth/camera.js`, `photobooth/config.js`; Test `test/camera.test.js`; `npm install ffmpeg-static` (adds to `dependencies`).

**Interfaces:**
- `config.js`: `photoboothConfig(env = process.env, platform = process.platform) -> { device, ffmpeg, publicUrl, ttl }`.
- `camera.js`: `parseModes(text) -> [{ width, height }]`; `chooseMode(modes, { maxWidth = 1920 }) -> mode | null` (largest 4:3 by width up to max, else largest up to max, else null); `probeArgs(platform, device)`, `captureArgs(platform, device, mode)`; `class Camera { constructor({ ffmpeg, device, platform, spawn, timeoutMs }); async probe(); async capture() -> Buffer }` with captures queued.

- [ ] **Step 1: Failing tests** (excerpt; write all)
```js
test("parseModes reads avfoundation and v4l2 listings", () => {
  const mac = "[in#0 @ 0x1] Supported modes:\n[in#0 @ 0x1]   1920x1080@[15.000000 30.000000]fps\n[in#0 @ 0x1]   1760x1328@[15.000000 30.000000]fps\n";
  assert.deepEqual(parseModes(mac), [{ width: 1920, height: 1080 }, { width: 1760, height: 1328 }]);
  const linux = "[video4linux2,v4l2 @ 0x1] Compressed:       mjpeg :          Motion-JPEG : 640x480 1280x720 1920x1080\n";
  assert.deepEqual(parseModes(linux), [{ width: 640, height: 480 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]);
});

test("chooseMode prefers the largest 4:3 mode up to the cap", () => {
  const modes = [{ width: 3840, height: 2160 }, { width: 1920, height: 1080 }, { width: 1760, height: 1328 }, { width: 640, height: 480 }];
  assert.deepEqual(chooseMode(modes), { width: 1760, height: 1328 });
  assert.deepEqual(chooseMode([{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]), { width: 1920, height: 1080 });
  assert.deepEqual(chooseMode([{ width: 3840, height: 2160 }]), null);
  assert.equal(chooseMode([]), null);
});

test("captureArgs builds the platform command", () => {
  const mac = captureArgs("darwin", "FaceTime", { width: 1760, height: 1328 });
  assert.deepEqual(mac.slice(0, 8), ["-hide_banner", "-loglevel", "error", "-f", "avfoundation", "-framerate", "30", "-pixel_format"]);
  assert.ok(mac.includes("1760x1328") && mac.includes("FaceTime") && mac.includes("pipe:1"));
  const linux = captureArgs("linux", "/dev/video0", null);
  assert.ok(linux.includes("v4l2") && !linux.includes("-video_size") && linux.includes("/dev/video0"));
});

test("Camera.capture returns ffmpeg's stdout and queues concurrent calls", async () => { /* fake spawn returning an EventEmitter with stdout/stderr streams; two captures resolve in order */ });
test("Camera.capture rejects with stderr on a non-zero exit", ...);
test("Camera.capture rejects on timeout and kills the process", ...);
test("Camera.probe picks a mode and tolerates failure", ...);
test("photoboothConfig defaults per platform and reads the environment", ...);
```
- [ ] **Step 2:** FAIL. **Step 3:** Implement with `child_process.spawn` injected (default import), stdout chunks concatenated, stderr kept for the error message (last 500 chars), `timeoutMs` default 15000 with `child.kill("SIGKILL")`, a promise chain as the queue. `probeArgs`: darwin `["-hide_banner","-f","avfoundation","-video_size","1x1","-i",device,"-frames:v","1","-f","null","-"]` parsing stderr; linux `["-hide_banner","-f","v4l2","-list_formats","all","-i",device]`. Config: `device` default `"0"` on darwin else `"/dev/video0"`; `ffmpeg` default from `import ffmpegPath from "ffmpeg-static"`; `publicUrl` strip trailing slash; `ttl` integer seconds.
- [ ] **Step 4:** `npm test` PASS. **Step 5:** Commit `Add ffmpeg camera capture with mode probing and config`.

---

### Task 3: Store

**Files:** Create `photobooth/store.js`; Test `test/store.test.js`.

**Interfaces:** `class PhotoStore { constructor({ dir, ttlMs, now = Date.now }); static validName(name); async purge(); async publish(name, png) -> { path, created: boolean }; async get(name) -> path | null; async sweep() -> deletedCount }`.

- [ ] **Step 1: Failing tests:** temp dir via `mkdtemp`; fake clock; `publish` writes and returns `created: true`; second publish returns `created: false` and does not rewrite (compare mtime); `get` after ttl returns null and removes the file; `sweep` deletes expired only; `purge` empties the dir; `validName` rejects `../x.png`, `abc.png`, `0123abcd-Poster.png`, accepts `0123abcd-poster.png`; `get` with an invalid name returns null without reading the dir (spy on `fs`? simpler: an invalid name on a non-existent dir must not throw).
- [ ] **Step 2:** FAIL. **Step 3:** Implement with `fs/promises`, a `Map` name → expires, `mkdir recursive` on publish.
- [ ] **Step 4:** PASS. **Step 5:** Commit `Add expiring photo store`.

---

### Task 4: Download route and sweeper

**Files:** Modify `server.js`; Test `test/api.test.js` (append).

**Interfaces:** `startServer(serviceHandler, port, { photoStore } = {})`; when a store is given, `GET /photobooth/:name` sends the file or 404 (`text/plain` "Not found"), and a 60 s interval calls `sweep()` (cleared on wss close). `index.js` creates the store from config and passes it.

- [ ] **Step 1: Failing tests:** start a server with a `PhotoStore` in a temp dir; publish a PNG; GET returns 200 `image/png`; unknown name 404; `../server.js` style name 404; after advancing the fake clock, 404.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; keep the static mount and 404 handler order.
- [ ] **Step 4:** PASS. **Step 5:** Commit `Serve published photobooth images with expiry`.

---

### Task 5: Screens

**Files:** Create `slice/photobooth-screens.js`; Modify `slice/qr.js` (add `{ errorCorrectionLevel = "M" }` option); Test `test/photobooth-screens.test.js`, `test/qr.test.js` (append one test).

**Interfaces:**
- `FILTERS` (the ordered preset names).
- `renderIdle() -> Screen` (row 12 centred text, bar with SPACE and SOMMAIRE).
- `renderBar(screen, { captured })` draws row 24 on an existing screen.
- `renderCountdown(digit) -> Screen` big mosaic digit centred (5 by 7 bitmap scaled 4 by 4 subpixels).
- `renderPicture(cells) -> Screen` paints cells at 1,1 then the captured bar.
- `renderQr(url) -> Screen | null` (null when the URL does not fit version 4 at level L: `url.length > 78`); `renderUrl(url) -> Screen` text fallback.
- `renderSmile() -> Screen`.

- [ ] **Step 1: Failing tests:** idle has the prompt on row 12 and `SPACE` inverse on row 24; captured bar contains `F` and `D`; countdown digits 3,2,1 produce mosaic cells in the middle and none at the corners; picture puts cell (1,1) from input; `renderQr` for a 60-char URL yields mosaic cells in rows 1..24 and null for 90 chars; `qrBitmap(text, { errorCorrectionLevel: "L" })` yields a smaller side than "M" for a 60-char text.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; reuse `drawBitmap`, `Screen`, `qrBitmap`. Digit bitmaps for 1, 2, 3 as 5 by 7 arrays.
- [ ] **Step 4:** PASS. **Step 5:** Commit `Add photobooth screens`.

---

### Task 6: Page and menu entry

**Files:** Create `slice/photobooth.js`; Modify `index.js`; Test `test/photobooth.test.js`.

**Interfaces:** `createPhotobooth({ camera, store, publicUrl, makeMinitel = (ws) => new Minitel(ws), sleep = ms => new Promise(...) , render = renderPng, convert = convertAll }) -> async (websocket) => lastKey`. `convertAll(jpeg) -> Map<filter, cells>` built on `prepare` + `applyFilter` + `toCells` for each preset, with one `prepare` per cell size.

Page state machine as in the spec. Stub Minitel in tests records calls (`home`, `cls`, `send`, `pos`, `print`, `inverse`, `color`, `message`, `plot`) and yields scripted keys from `key()`.

- [ ] **Step 1: Failing tests:** `sommaire leaves idle`; `space captures, converts every filter and shows poster`; `f cycles and notifies`; `d before capture shows the hint`; `d publishes once and shows the qr; second d renders once`; `space during capture is ignored` (camera promise resolved manually); `capture failure shows a message and stays idle`; `url too long falls back to text`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; `index.js`: `{ key: "P", title: "photobooth", handoff: createPhotobooth({ camera, store, publicUrl }) }` with the camera probed once at startup (errors logged), store purged, and the store passed to `startServer`.
- [ ] **Step 4:** PASS. **Step 5:** Commit `Add photobooth page`.

---

### Task 7: Manual run, docs, devlog

- [ ] Run `npm run dev`, open the emulator, press `P`, then SPACE; confirm the countdown, the shot, F cycling with notifications, D showing a QR whose URL opens the PNG in a browser, expiry after `PHOTOBOOTH_TTL=20` seconds, and SOMMAIRE returning to the menu. Note the camera used in the log.
- [ ] README: photobooth section (keys, env vars, ffmpeg-static, Pi notes: add the user to the `video` group). Spec: any deviations. Meta-repo: copy plan as `plan-photobooth.md`, spec as `design-photobooth.md`, log entry.
