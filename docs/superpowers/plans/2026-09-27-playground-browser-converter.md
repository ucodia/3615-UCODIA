# Playground Browser Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the image converter inside the playground page by default, sharing every stage except decode-and-resample with the node path, with a checkbox to route through the server endpoint instead.

**Architecture:** `image/prepare.js` is split into a pure core, `image/field.js` (luminance, levels, gamma, cover-crop geometry), and two thin front ends: the existing sharp one for node and a new canvas one, `image/prepare-browser.js`, for the page. `server.js` serves `image/`, `screen.js` and `mosaic.js` under `/lib` so the page can import the same modules node uses. The playground becomes a module script that converts locally, with a "server converter" checkbox that posts to `/api/vdt` instead.

**Tech Stack:** Node 22 ESM, `node --test`, sharp 0.34, express 4.22, browser canvas and ES modules, the vendored emulator.

**Spec:** `docs/superpowers/specs/2026-09-27-image-to-videotex-design.md`, amended by Task 5 of this plan. Design agreed in chat on 2026-09-27: only decode, crop and resample may exist twice; everything else is shared.

## Global Constraints

- ESM only, Node 22, two-space indent, double quotes, semicolons.
- Tests in `test/*.test.js`, `node:test`, run with `npm test`. Suite currently 99 passing; it must stay green after every task.
- A field is `{ width, height, data: Float32Array }` in `[0, 1]`, row major, `width = 2*cols`, `height = 3*rows`.
- Luminance is `0.299 R + 0.587 G + 0.114 B` on 8-bit values, on both sides.
- Crop anchors supported everywhere: `centre`, `top`, `bottom`, `left`, `right`. The playground offers only these. `attention` and `entropy` remain valid for the CLI and endpoint.
- The `POST /api/vdt` endpoint and the CLI keep their behaviour and output byte for byte for greyscale input. Correction after review: colour input changes, since node moves from libvips' linear-light greyscale to the shared Rec. 601 luminance; see the spec amendment.
- Never touch unrelated code. Commit after each task. No AI co-author lines.

## Review Focus

1. A greyscale PNG (one channel) through node prepare must still convert; pinned in Task 2 (`prepare accepts a single-channel image`).
2. A colour image must give the same luminance on both sides; pinned in Task 1 (`rgbToField uses Rec. 601 luminance`) and Task 2 (`prepare converts colour with the shared luminance`).
3. `/lib` must serve only what the page needs and never `index.js`-style server secrets; there are none, but the mount must not expose the repo root; pinned in Task 3 (`lib mount does not expose the repo root`).
4. Uploading a transparent PNG in the browser must flatten onto black like node; covered by the black fill in `prepareCanvas` and the headless check in Task 4.
5. The server checkbox must produce the same picture the endpoint gave before this change; checked in Task 4 by comparing bytes with the CLI output for the same file.

---

### Task 1: Pure field core

**Files:**
- Create: `image/field.js`
- Test: `test/field.test.js`

**Interfaces:**
- Produces: `stretch(data, lo, hi) -> Float32Array`; `rgbToField(pixels, width, height, { levels, gamma }) -> field` where `pixels` is interleaved 1, 3 or 4 channel 8-bit data; `coverRect(srcW, srcH, dstW, dstH, position) -> { sx, sy, sw, sh }`.

- [ ] **Step 1: Write the failing tests**

```js
// test/field.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { stretch, rgbToField, coverRect } from "../image/field.js";

test("stretch maps the 1st and 99th percentiles to 0 and 1", () => {
  const data = Float32Array.from({ length: 1000 }, (_, i) => 0.25 + (i / 999) * 0.5);
  const out = stretch(data);
  assert.equal(out[0], 0);
  assert.equal(out[999], 1);
  assert.ok(Math.abs(out[500] - 0.5) < 0.02);
});

test("stretch leaves a flat field unchanged", () => {
  const out = stretch(Float32Array.from({ length: 100 }, () => 0.5));
  for (const v of out) assert.equal(v, 0.5);
});

test("rgbToField uses Rec. 601 luminance and ignores alpha", () => {
  const rgb = Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
  const f = rgbToField(rgb, 4, 1, { levels: false });
  assert.ok(Math.abs(f.data[0] - 0.299) < 1e-3);
  assert.ok(Math.abs(f.data[1] - 0.587) < 1e-3);
  assert.ok(Math.abs(f.data[2] - 0.114) < 1e-3);
  assert.equal(f.data[3], 1);
  const rgba = Uint8Array.from([255, 0, 0, 0, 0, 255, 0, 128]);
  const g = rgbToField(rgba, 2, 1, { levels: false });
  assert.ok(Math.abs(g.data[0] - 0.299) < 1e-3);
  assert.ok(Math.abs(g.data[1] - 0.587) < 1e-3);
});

test("rgbToField passes a single channel through", () => {
  const f = rgbToField(Uint8Array.from([0, 128, 255]), 3, 1, { levels: false });
  assert.deepEqual([...f.data].map((v) => Math.round(v * 255)), [0, 128, 255]);
  assert.equal(f.width, 3);
  assert.equal(f.height, 1);
});

test("rgbToField rejects other channel counts", () => {
  assert.throws(() => rgbToField(new Uint8Array(4), 2, 1), /channels/);
});

test("rgbToField applies levels then gamma", () => {
  const grey = Uint8Array.from({ length: 200 }, (_, i) => 64 + Math.round((i / 199) * 128));
  const levelled = rgbToField(grey, 200, 1);
  assert.equal(levelled.data[0], 0);
  assert.equal(levelled.data[199], 1);
  const dark = rgbToField(Uint8Array.from([128]), 1, 1, { levels: false, gamma: 2 });
  assert.ok(Math.abs(dark.data[0] - (128 / 255) ** 2) < 1e-6);
});

test("coverRect crops a wide source horizontally by anchor", () => {
  assert.deepEqual(coverRect(480, 270, 320, 240, "centre"), { sx: 60, sy: 0, sw: 360, sh: 270 });
  assert.deepEqual(coverRect(480, 270, 320, 240, "left"), { sx: 0, sy: 0, sw: 360, sh: 270 });
  assert.deepEqual(coverRect(480, 270, 320, 240, "right"), { sx: 120, sy: 0, sw: 360, sh: 270 });
  assert.deepEqual(coverRect(480, 270, 320, 240, "top"), { sx: 60, sy: 0, sw: 360, sh: 270 });
});

test("coverRect crops a tall source vertically by anchor", () => {
  assert.deepEqual(coverRect(300, 600, 320, 240, "centre"), { sx: 0, sy: 187.5, sw: 300, sh: 225 });
  assert.deepEqual(coverRect(300, 600, 320, 240, "top"), { sx: 0, sy: 0, sw: 300, sh: 225 });
  assert.deepEqual(coverRect(300, 600, 320, 240, "bottom"), { sx: 0, sy: 375, sw: 300, sh: 225 });
});

test("coverRect rejects anchors the canvas path cannot do", () => {
  assert.throws(() => coverRect(100, 100, 320, 240, "attention"), /position/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/field.test.js`
Expected: FAIL, cannot find module `../image/field.js`

- [ ] **Step 3: Write the implementation**

```js
// image/field.js
export function stretch(data, lo = 0.01, hi = 0.99) {
  const sorted = Float32Array.from(data).sort();
  const a = sorted[Math.floor(lo * (sorted.length - 1))];
  const b = sorted[Math.floor(hi * (sorted.length - 1))];
  if (b - a < 1e-6) return Float32Array.from(data);
  return data.map((v) => Math.min(1, Math.max(0, (v - a) / (b - a))));
}

// Interleaved 8-bit pixels, 1 (grey), 3 (RGB) or 4 (RGBA) channels, to a lightness field.
export function rgbToField(pixels, width, height, { levels = true, gamma = 1 } = {}) {
  const count = width * height;
  const channels = pixels.length / count;
  if (channels !== 1 && channels !== 3 && channels !== 4) {
    throw new Error(`Expected 1, 3 or 4 channels, got ${channels}`);
  }
  let data = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * channels;
    data[i] = channels === 1
      ? pixels[o] / 255
      : (0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2]) / 255;
  }
  if (levels) data = stretch(data);
  if (gamma !== 1) data = data.map((v) => v ** gamma);
  return { width, height, data };
}

const ANCHORS = {
  centre: [0.5, 0.5],
  top: [0.5, 0],
  bottom: [0.5, 1],
  left: [0, 0.5],
  right: [1, 0.5],
};

// Source rectangle that covers the destination aspect ratio, placed by anchor.
export function coverRect(srcW, srcH, dstW, dstH, position = "centre") {
  const anchor = ANCHORS[position];
  if (!anchor) throw new Error(`Unsupported crop position ${position}`);
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / scale;
  const sh = dstH / scale;
  return { sx: (srcW - sw) * anchor[0], sy: (srcH - sh) * anchor[1], sw, sh };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/field.test.js`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add image/field.js test/field.test.js
git commit -m "Add pure field core: luminance, levels, gamma and cover-crop geometry"
```

---

### Task 2: Node prepare on the shared core

**Files:**
- Modify: `image/prepare.js`
- Modify: `test/prepare.test.js` (remove the two `stretch` tests, add two tests)

**Interfaces:**
- Consumes: `rgbToField` from Task 1.
- Produces: `prepare(source, cols, rows, { position, levels, gamma, maxPixels })` unchanged in signature and behaviour. `stretch` is no longer exported from `prepare.js`.

- [ ] **Step 1: Update the tests**

In `test/prepare.test.js`, change the import to `import { prepare } from "../image/prepare.js";`, delete the two tests named `stretch maps the 1st and 99th percentiles to 0 and 1` and `stretch leaves a flat field unchanged` (they now live in `test/field.test.js`), and append:

```js
test("prepare converts colour with the shared luminance", async () => {
  const src = await sharp({ create: { width: 16, height: 12, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
  const f = await prepare(src, 2, 1, { levels: false });
  for (const v of f.data) assert.ok(Math.abs(v - 0.299) < 0.01, `got ${v}`);
});

test("prepare accepts a single-channel image", async () => {
  const src = await png(16, 12, () => 200);
  const f = await prepare(src, 2, 1, { levels: false });
  for (const v of f.data) assert.ok(Math.abs(v - 200 / 255) < 0.01, `got ${v}`);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test test/prepare.test.js`
Expected: the colour test FAILS (sharp's own greyscale gives a different red weight, about 0.21 to 0.30 depending on the libvips path; the assertion may pass by luck, in which case note it and continue). The single-channel test passes already. The import of `stretch` is gone so the file loads.

- [ ] **Step 3: Rewrite prepare.js**

```js
// image/prepare.js
import sharp from "sharp";
import { rgbToField } from "./field.js";

const MAX_PIXELS = 40_000_000;

export async function prepare(source, cols, rows, { position = "centre", levels = true, gamma = 1, maxPixels = MAX_PIXELS } = {}) {
  const width = cols * 2;
  const height = rows * 3;
  // sharp keeps only the last resize of a pipeline, so crop and resample are two pipelines
  const cropped = await sharp(source, { limitInputPixels: maxPixels })
    .flatten({ background: "#000000" })
    .resize(cols * 8, rows * 10, { fit: "cover", position })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { channels } = cropped.info;
  const raw = await sharp(cropped.data, { raw: { width: cols * 8, height: rows * 10, channels } })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return rgbToField(raw.data, width, height, { levels, gamma });
}
```

Note: `rgbToField` derives the channel count from the buffer length, so a 1-channel PNG and a 3-channel JPEG both work. If the second pipeline reports a channel count that does not divide the buffer, the field core throws; that would mean sharp changed its raw output rules.

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS. The prepare suite has 9 tests. The convert, cli and api suites still pass, which proves the endpoint and CLI behave as before.

- [ ] **Step 5: Commit**

```bash
git add image/prepare.js test/prepare.test.js
git commit -m "Node prepare delegates luminance, levels and gamma to the shared field core"
```

---

### Task 3: Serve the shared modules under /lib

**Files:**
- Modify: `server.js`
- Test: `test/api.test.js` (append)

**Interfaces:**
- Produces: `GET /lib/image/<file>` serves files from `image/`; `GET /lib/screen.js` and `GET /lib/mosaic.js` serve the root encoders. Nothing else under `/lib`.

- [ ] **Step 1: Write the failing tests**

Append to `test/api.test.js`:

```js
test("serves the converter modules under /lib", async () => {
  for (const path of ["/lib/image/quantise.js", "/lib/image/field.js", "/lib/screen.js", "/lib/mosaic.js"]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type"), /javascript/, path);
  }
});

test("lib mount does not expose the repo root", async () => {
  for (const path of ["/lib/server.js", "/lib/package.json", "/lib/image/../server.js"]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 404, path);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/api.test.js`
Expected: FAIL on the first new test with status 404

- [ ] **Step 3: Add the mounts**

In `server.js`, directly after the `app.post("/api/vdt", ...)` line:

```js
  app.use("/lib/image", express.static(path.join(__dirname, "image")));
  for (const file of ["screen.js", "mosaic.js"]) {
    app.get(`/lib/${file}`, (req, res) => res.sendFile(path.join(__dirname, file)));
  }
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server.js test/api.test.js
git commit -m "Serve the converter modules and encoders to the browser under /lib"
```

---

### Task 4: Browser prepare and the playground on local modules

**Files:**
- Create: `image/prepare-browser.js`
- Modify: `emulator/playground.html`

**Interfaces:**
- Consumes: `rgbToField`, `coverRect` (Task 1); `/lib` routes (Task 3); `quantise`, `paint`, `parseOptions`, `Screen`, `encode`.
- Produces: `prepareCanvas(source, cols, rows, { position, levels, gamma, mirror }) -> field`, where `source` is an `HTMLImageElement`, `HTMLVideoElement`, `ImageBitmap` or canvas.

- [ ] **Step 1: Write prepare-browser.js**

```js
// image/prepare-browser.js
// Browser counterpart of prepare.js: canvas does the decode, crop and resample,
// the shared field core does the rest.
import { rgbToField, coverRect } from "./field.js";

const stage = document.createElement("canvas");
const target = document.createElement("canvas");

function sizeOf(source) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  if (!width || !height) throw new Error("Source has no pixels yet");
  return { width, height };
}

export function prepareCanvas(source, cols, rows, { position = "centre", levels = true, gamma = 1, mirror = false } = {}) {
  const src = sizeOf(source);
  const { sx, sy, sw, sh } = coverRect(src.width, src.height, cols * 8, rows * 10, position);
  stage.width = cols * 8;
  stage.height = rows * 10;
  const sctx = stage.getContext("2d");
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.imageSmoothingQuality = "high";
  sctx.fillStyle = "#000";
  sctx.fillRect(0, 0, stage.width, stage.height);
  if (mirror) sctx.setTransform(-1, 0, 0, 1, stage.width, 0);
  sctx.drawImage(source, sx, sy, sw, sh, 0, 0, stage.width, stage.height);

  const width = cols * 2;
  const height = rows * 3;
  target.width = width;
  target.height = height;
  const tctx = target.getContext("2d");
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(stage, 0, 0, width, height);
  const { data } = tctx.getImageData(0, 0, width, height);
  return rgbToField(data, width, height, { levels, gamma });
}
```

- [ ] **Step 2: Rewrite the playground page**

Replace `emulator/playground.html` in full:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>3615 image playground</title>
    <script src="library/utils.js"></script>
    <script src="library/minitel.js"></script>
    <style>
      html, body { height: 100%; margin: 0; }
      body { display: grid; grid-template-columns: 1fr 300px; background: #202020; color: #ddd; font: 14px/1.4 system-ui, sans-serif; }
      #stage { display: flex; align-items: center; justify-content: center; padding: 16px; min-width: 0; }
      x-minitel { display: block; width: 100%; }
      #stage canvas { display: block; image-rendering: pixelated; height: auto; margin: 0 auto; width: min(100%, calc((100vh - 32px) * 1.28)); }
      #stage.over { outline: 3px dashed #ddd; outline-offset: -8px; }
      aside { display: flex; flex-direction: column; gap: 16px; padding: 16px; overflow-y: auto; background: #181818; border-left: 1px solid #333; }
      section h2 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #999; }
      .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
      #video { display: block; width: 100%; background: #000; margin-bottom: 8px; transform: scaleX(-1); }
      #video[hidden] { display: none; }
      form { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; }
      form label { justify-self: end; color: #bbb; }
      input, select, button { font: inherit; min-width: 0; }
      input[type="number"], input[type="text"], select { width: 100%; box-sizing: border-box; }
      #file { width: 100%; }
      #hint { color: #888; font-size: 12px; }
      #status { white-space: pre-wrap; color: #bbb; }
    </style>
  </head>
  <body>
    <div id="stage">
      <x-minitel data-speed="4800" data-color="false" data-socket="none">
        <canvas class="minitel-screen" data-minitel="screen"></canvas>
      </x-minitel>
    </div>
    <aside>
      <section>
        <h2>Camera</h2>
        <video id="video" autoplay playsinline muted hidden></video>
        <div class="row">
          <button type="button" id="camera-toggle">start camera</button>
        </div>
      </section>
      <section>
        <h2>Image</h2>
        <input type="file" id="file" accept="image/*" />
        <div id="hint">or drop / paste an image anywhere. Loading an image stops the camera.</div>
      </section>
      <section>
        <h2>Settings</h2>
        <form id="settings">
          <label for="preset">preset</label>
          <select name="preset" id="preset">
            <option>photo</option><option>poster</option><option>halftone</option><option>newsprint</option><option>stencil</option>
          </select>
          <label for="method">method</label>
          <select name="method" id="method">
            <option value="">preset default</option><option>flat</option><option>diffuse</option><option>bayer</option>
          </select>
          <label for="palette">palette</label>
          <input name="palette" id="palette" type="text" placeholder="e.g. 0,4,7" />
          <label for="tone">tone</label>
          <input name="tone" id="tone" type="number" min="0" step="0.5" placeholder="preset default" />
          <label for="levels">levels</label>
          <input name="levels" id="levels" type="checkbox" checked style="justify-self: start" />
          <label for="gamma">gamma</label>
          <input name="gamma" id="gamma" type="number" min="0.1" step="0.1" value="1" />
          <label for="position">crop</label>
          <select name="position" id="position">
            <option>centre</option><option>top</option><option>bottom</option><option>left</option><option>right</option>
          </select>
          <label for="cols">cols</label>
          <input name="cols" id="cols" type="number" min="1" max="40" value="40" />
          <label for="rows">rows</label>
          <input name="rows" id="rows" type="number" min="1" max="24" value="24" />
          <label for="row">row</label>
          <input name="row" id="row" type="number" min="1" max="24" value="1" />
          <label for="col">col</label>
          <input name="col" id="col" type="number" min="1" max="40" value="1" />
          <label for="server">server</label>
          <input name="server" id="server" type="checkbox" style="justify-self: start" title="convert through POST /api/vdt (sharp) instead of in the browser" />
        </form>
      </section>
      <section>
        <button type="button" id="replay">replay at 4800 baud</button>
      </section>
      <section>
        <h2>Status</h2>
        <div id="status">No image yet.</div>
      </section>
    </aside>
    <script type="module">
      import { Screen, encode } from "/lib/screen.js";
      import { quantise } from "/lib/image/quantise.js";
      import { paint } from "/lib/image/paint.js";
      import { parseOptions } from "/lib/image/options.js";
      import { prepareCanvas } from "/lib/image/prepare-browser.js";

      const [emulator] = Minitel.startEmulators();
      const form = document.getElementById("settings");
      const status = document.getElementById("status");
      const stage = document.getElementById("stage");
      const video = document.getElementById("video");
      const cameraToggle = document.getElementById("camera-toggle");
      const serverBox = document.getElementById("server");
      const frameCanvas = document.createElement("canvas");
      let source = null; // { name, file, bitmap } for an image, { name, camera: true } for the webcam
      let bytes = null;
      let stream = null;
      let generation = 0;

      function rawOptions() {
        const data = new FormData(form);
        const raw = {};
        for (const [key, value] of data) if (value !== "" && key !== "levels" && key !== "server") raw[key] = value;
        raw.levels = data.has("levels") ? "true" : "false";
        return raw;
      }

      function show(name, result, path) {
        bytes = result;
        status.textContent = `${name} via ${path}: ${bytes.length} bytes, ${(bytes.length / 480).toFixed(1)} s at 4800 baud`;
        emulator.directSend([0x0c, ...bytes]);
      }

      function convertLocal(options) {
        const drawable = source.camera ? video : source.bitmap;
        const field = prepareCanvas(drawable, options.cols, options.rows, {
          position: options.position,
          levels: options.levels,
          gamma: options.gamma,
          mirror: Boolean(source.camera),
        });
        const cells = quantise(field, options.quantise);
        const screen = new Screen(24, 40);
        paint(screen, options.row, options.col, cells);
        return Array.from(encode(screen), (c) => c.charCodeAt(0));
      }

      async function convertServer(raw) {
        const body = source.camera ? await frame() : await source.file.arrayBuffer();
        const res = await fetch(`/api/vdt?${new URLSearchParams(raw)}`, { method: "POST", body });
        if (!res.ok) throw new Error(await res.text());
        return Array.from(new Uint8Array(await res.arrayBuffer()));
      }

      // only the latest request may touch the screen; earlier ones can still be in flight
      async function convert() {
        if (!source) return;
        const mine = ++generation;
        const { name } = source;
        const raw = rawOptions();
        try {
          const options = parseOptions(raw);
          const result = serverBox.checked ? await convertServer(raw) : convertLocal(options);
          if (mine === generation) show(name, result, serverBox.checked ? "server" : "browser");
        } catch (error) {
          if (mine === generation) status.textContent = `Error: ${error.message}`;
        }
      }

      async function load(file) {
        if (!file || !file.type.startsWith("image/")) return;
        stopCamera();
        try {
          const bitmap = await createImageBitmap(file);
          source = { name: file.name || "pasted image", file, bitmap };
        } catch (error) {
          status.textContent = `Cannot decode ${file.name || "image"}: ${error.message}`;
          return;
        }
        convert();
      }

      async function startCamera() {
        if (!navigator.mediaDevices?.getUserMedia) {
          status.textContent = "Camera needs a secure context: open the page on localhost or over HTTPS.";
          return;
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 } }, audio: false });
        } catch (error) {
          status.textContent = `Camera error: ${error.message}`;
          return;
        }
        video.srcObject = stream;
        video.hidden = false;
        cameraToggle.textContent = "stop camera";
        await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));
        source = { name: "camera", camera: true };
        liveLoop();
      }

      function stopCamera() {
        if (!stream) return;
        for (const track of stream.getTracks()) track.stop();
        stream = null;
        video.srcObject = null;
        video.hidden = true;
        cameraToggle.textContent = "start camera";
        if (source?.camera) source = null;
      }

      // JPEG of the mirrored camera frame, for the server path only
      function frame() {
        const scale = Math.min(1, 640 / video.videoWidth);
        frameCanvas.width = Math.round(video.videoWidth * scale);
        frameCanvas.height = Math.round(video.videoHeight * scale);
        const ctx = frameCanvas.getContext("2d");
        ctx.setTransform(-1, 0, 0, 1, frameCanvas.width, 0);
        ctx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);
        return new Promise((resolve) => frameCanvas.toBlob((blob) => blob.arrayBuffer().then(resolve), "image/jpeg", 0.9));
      }

      let looping = false;
      async function liveLoop() {
        if (looping) return;
        looping = true;
        while (stream && source?.camera) {
          await convert();
          await new Promise((resolve) => setTimeout(resolve, serverBox.checked ? 150 : 30));
        }
        looping = false;
      }

      document.getElementById("file").addEventListener("change", (e) => {
        load(e.target.files[0]);
        e.target.value = "";
      });
      document.addEventListener("paste", (e) => {
        const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
        if (item) load(item.getAsFile());
      });
      document.addEventListener("dragover", (e) => { e.preventDefault(); stage.classList.add("over"); });
      document.addEventListener("dragleave", () => stage.classList.remove("over"));
      document.addEventListener("drop", (e) => {
        e.preventDefault();
        stage.classList.remove("over");
        load(e.dataTransfer.files[0]);
      });
      form.addEventListener("change", convert);
      document.getElementById("replay").addEventListener("click", () => {
        if (!bytes) return;
        emulator.directSend([0x0c]);
        emulator.send(bytes);
      });
      cameraToggle.addEventListener("click", () => (stream ? stopCamera() : startCamera()));
      window.playground = { load, convert, startCamera }; // for headless checks
    </script>
  </body>
</html>
```

- [ ] **Step 3: Verify headlessly**

With `npm run dev` running, create a throwaway `emulator/_probe.html` that is the playground plus this script before `</body>`, and copy `screens/omelette-large.png` to `emulator/_probe.png`:

```html
<script type="module">
  window.addEventListener("error", (e) => console.log("PROBE-ERROR", e.message));
  const blob = await fetch("/_probe.png").then((r) => r.blob());
  const file = new File([blob], "probe.png", { type: "image/png" });
  await window.playground.load(file);
  await new Promise((r) => setTimeout(r, 500));
  console.log("PROBE-LOCAL", document.getElementById("status").textContent);
  document.getElementById("server").checked = true;
  await window.playground.convert();
  await new Promise((r) => setTimeout(r, 1500));
  console.log("PROBE-SERVER", document.getElementById("status").textContent);
</script>
```

Run headless Chrome with `--virtual-time-budget=10000 --enable-logging=stderr --v=0 --screenshot=...` on `http://localhost:3615/_probe.html` and grep `PROBE-`. Expected: `PROBE-LOCAL probe.png via browser: N bytes`, `PROBE-SERVER probe.png via server: M bytes`, no `PROBE-ERROR`, and the server byte count equals `node bin/img2vdt.js screens/omelette-large.png | wc -c` for the same defaults. Open the screenshot and confirm the picture renders. Delete `_probe.html` and `_probe.png` afterwards. Also check the server log shows no `POST /api/vdt` for the local conversion.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS (no node test changes in this task)

- [ ] **Step 5: Commit**

```bash
git add image/prepare-browser.js emulator/playground.html
git commit -m "Playground converts in the browser with the shared modules, server path behind a checkbox"
```

---

### Task 5: Docs

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-09-27-image-to-videotex-design.md`
- Meta-repo: `~/code/meta-repo/3615/image-to-videotex/execution-log.md`, copy this plan as `plan-browser-converter.md`

- [ ] **Step 1: README**

Replace the playground paragraph with:

```markdown
Playground: run `npm run dev` and open `http://localhost:3615/playground.html`. Drop, paste or pick an image, or start the webcam for a live feed, change settings and watch the result in the emulator. Loading an image stops the camera. Conversion runs in the browser with the same `image/` modules node uses, except that a canvas does the resampling instead of sharp; tick "server" to convert through `POST /api/vdt` instead and compare. "Replay at 4800 baud" shows the reveal at link speed. The camera needs localhost or HTTPS.
```

- [ ] **Step 2: Spec amendment**

Append to the spec, before "## Follow-ups, not in this spec":

```markdown
## Amendment 2026-09-27: browser conversion in the playground

The playground now converts in the browser by default. `image/prepare.js` was split: `image/field.js` holds the pure core (Rec. 601 luminance, percentile levels, gamma, cover-crop geometry) and both the sharp front end and a canvas front end, `image/prepare-browser.js`, call it. `server.js` serves `image/`, `screen.js` and `mosaic.js` under `/lib` for the page. A "server" checkbox routes the same options through `POST /api/vdt` for comparison. Measured on portraits, the two paths differ by about 1 percent per subpixel before quantising and are visually equivalent; diffusion presets differ cell for cell because the dither pattern is chaotic. The endpoint and CLI keep the sharp path for the photobooth. The playground offers only the five geometric crop anchors.
```

- [ ] **Step 3: Suite, commit, meta-repo**

```bash
npm test
git add README.md docs/superpowers/specs/2026-09-27-image-to-videotex-design.md
git commit -m "Document browser conversion in the playground"
cp docs/superpowers/plans/2026-09-27-playground-browser-converter.md ~/code/meta-repo/3615/image-to-videotex/plan-browser-converter.md
```

Append a dated entry to the meta-repo execution log (commits, deviations, headless check results) and commit only those two paths there.
