# Image to Videotex Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert a raster image into greyscale Minitel mosaic cells with selectable looks, exposed as a module, a CLI, an HTTP endpoint and a web playground that renders through the emulator without a websocket.

**Architecture:** A new `image/` directory holds three pure stages: `prepare` (sharp: crop, resample, levels) turns an image into a grey field of `2*cols` by `3*rows` subpixels; `quantise` fits each 2x3 block to one mosaic pattern and a foreground/background pair, by exhaustive search with an optional error-diffusion or Bayer pass; `paint` writes the cells into the existing `Screen` from `screen.js`, which already encodes videotex. `convert` in `image/index.js` chains them behind a validated option set shared by the CLI and the `POST /api/vdt` endpoint. The playground page posts an image to that endpoint and feeds the bytes to the emulator.

**Tech Stack:** Node 22 ESM, `node --test` (built in), `sharp` 0.34, `commander` 14, `express` 4.22, the vendored emulator in `emulator/library/minitel.js`.

**Spec:** `docs/superpowers/specs/2026-09-27-image-to-videotex-design.md` (copy in `~/code/meta-repo/3615/image-to-videotex/design.md`).

## Global Constraints

- ESM only (`"type": "module"`), Node 22. Two-space indent, double quotes, semicolons, matching `screen.js`.
- Tests live in `test/*.test.js`, use `node:test` and `node:assert/strict`, run with `npm test`.
- Grey levels by colour index: `[0, 0.5, 0.7, 0.9, 0.4, 0.6, 0.8, 1]`. Defined once in `image/levels.js`.
- Mosaic bit `i` is subpixel `(dx, dy)` with `i = dy*2 + dx`. Cells are `{ bits, fg, bg }` with `bits` 0..63 and `fg`, `bg` colour indices 0..7.
- A field is `{ width, height, data }` with `width = 2*cols`, `height = 3*rows`, `data` a `Float32Array` of lightness in `[0, 1]`, row major.
- Defaults: `cols 40`, `rows 24`, `row 1`, `col 1`, preset `photo`, `toneWeight 2`, `levels true`, `gamma 1`, crop position `centre`.
- 4800 baud is 480 bytes per second for reporting.
- Never touch code unrelated to the task. Commit after each task with a concise message. No AI co-author lines. No links to sessions.
- Work on branch `slice`.

## Review Focus

1. A uniform image (single flat colour) must not produce NaN or a black field from the levels stretch. Pinned in Task 5 (`stretch leaves a flat field unchanged`).
2. A source smaller than the grid, such as a 10x10 icon, must upscale and convert rather than throw. Pinned in Task 5 (`prepare upscales a small image`).
3. Query strings with garbage (`cols=abc`, `palette=9`, `preset=nope`) must return 400 from the endpoint, never 500. Pinned in Task 7 (options tests) and Task 8 (endpoint test).
4. An image painted at `row`/`col` that overruns the screen must clip silently, matching `drawBitmap`. Pinned in Task 6 (`paint clips outside the screen`).
5. An empty or non-image request body must return 400 with a message. Pinned in Task 8 (`rejects an empty body`, `rejects a non-image body`).

---

### Task 1: Grey levels and cell rendering helpers

**Files:**
- Create: `image/levels.js`
- Test: `test/levels.test.js`

**Interfaces:**
- Produces: `LEVELS` (frozen `number[8]`), `ALL_COLOURS` (frozen `[0..7]`), `renderCell({ bits, fg, bg }) -> number[6]` (lightness per subpixel), `mean(values) -> number`.

- [ ] **Step 1: Write the failing test**

```js
// test/levels.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, ALL_COLOURS, renderCell, mean } from "../image/levels.js";

test("levels follow the emulator grey table by colour index", () => {
  assert.deepEqual([...LEVELS], [0, 0.5, 0.7, 0.9, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual([...ALL_COLOURS], [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("renderCell maps lit bits to fg and the rest to bg", () => {
  // bits 0b000001 lights subpixel (dx 0, dy 0) only
  assert.deepEqual(renderCell({ bits: 1, fg: 7, bg: 0 }), [1, 0, 0, 0, 0, 0]);
  // bits 0b100000 lights subpixel (dx 1, dy 2) only
  assert.deepEqual(renderCell({ bits: 32, fg: 4, bg: 1 }), [0.5, 0.5, 0.5, 0.5, 0.5, 0.4]);
});

test("mean averages the values", () => {
  assert.equal(mean([0, 0.5, 1]), 0.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/levels.test.js`
Expected: FAIL, cannot find module `../image/levels.js`

- [ ] **Step 3: Write minimal implementation**

```js
// image/levels.js
export const LEVELS = Object.freeze([0, 0.5, 0.7, 0.9, 0.4, 0.6, 0.8, 1]);
export const ALL_COLOURS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]);

export function renderCell({ bits, fg, bg }) {
  const out = new Array(6);
  for (let i = 0; i < 6; i++) out[i] = LEVELS[(bits >> i) & 1 ? fg : bg];
  return out;
}

export function mean(values) {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/levels.test.js`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add image/levels.js test/levels.test.js
git commit -m "Add Minitel grey level table and cell rendering helper"
```

---

### Task 2: Exact cell fit and the flat method

**Files:**
- Create: `image/quantise.js`
- Test: `test/quantise.test.js`

**Interfaces:**
- Consumes: `LEVELS`, `ALL_COLOURS`, `mean`, `renderCell` from Task 1.
- Produces: `fitCell(target6, { palette, toneWeight }) -> { bits, fg, bg, cost }`, `cellTarget(field, cx, cy) -> number[6]`, `quantise(field, { method, palette, toneWeight, serpentine }) -> cells[rows][cols]` where each cell is `{ bits, fg, bg }`. Tasks 3 and 4 add methods to the same file.

- [ ] **Step 1: Write the failing tests**

```js
// test/quantise.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitCell, cellTarget, quantise } from "../image/quantise.js";
import { renderCell, mean } from "../image/levels.js";

function field(width, height, fn) {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data[y * width + x] = fn(x, y);
  return { width, height, data };
}

test("fitCell maps a uniform block to pattern 0 with the nearest level", () => {
  const cell = fitCell([0.72, 0.72, 0.72, 0.72, 0.72, 0.72]);
  assert.equal(cell.bits, 0);
  assert.equal(cell.fg, cell.bg);
  assert.equal(cell.bg, 2); // 0.7
});

test("fitCell recovers a two-tone block exactly", () => {
  // top row white, rest black -> bits 0b000011, fg 7, bg 0 (or the complement)
  const cell = fitCell([1, 1, 0, 0, 0, 0]);
  assert.deepEqual(renderCell(cell), [1, 1, 0, 0, 0, 0]);
  assert.equal(cell.cost, 0);
});

test("fitCell only uses colours from the palette", () => {
  const cell = fitCell([0.55, 0.55, 0.55, 0.55, 0.55, 0.55], { palette: [0, 7] });
  assert.ok([0, 7].includes(cell.fg));
  assert.ok([0, 7].includes(cell.bg));
});

test("fitCell with tone weight prefers the right mean over the right shape", () => {
  const target = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15];
  const shape = fitCell(target, { toneWeight: 0 });
  const toned = fitCell(target, { toneWeight: 2 });
  assert.equal(shape.bits, 0); // solid black is closest per subpixel
  assert.ok(Math.abs(mean(renderCell(toned)) - 0.15) < Math.abs(mean(renderCell(shape)) - 0.15));
});

test("cellTarget reads the 2x3 block in bit order", () => {
  const f = field(4, 3, (x, y) => (y * 4 + x) / 100);
  assert.deepEqual(cellTarget(f, 1, 0), [0.02, 0.03, 0.06, 0.07, 0.1, 0.11].map((v) => Math.fround(v)));
});

test("quantise flat returns one cell per block without cost", () => {
  const f = field(4, 6, (x, y) => (y < 3 ? 1 : 0));
  const cells = quantise(f, { method: "flat" });
  assert.equal(cells.length, 2);
  assert.equal(cells[0].length, 2);
  assert.deepEqual(Object.keys(cells[0][0]).sort(), ["bg", "bits", "fg"]);
  assert.deepEqual(renderCell(cells[0][0]), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(renderCell(cells[1][1]), [0, 0, 0, 0, 0, 0]);
});

test("quantise rejects an unknown method", () => {
  assert.throws(() => quantise(field(2, 3, () => 0), { method: "magic" }), /Unknown method/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/quantise.test.js`
Expected: FAIL, cannot find module `../image/quantise.js`

- [ ] **Step 3: Write the implementation**

```js
// image/quantise.js
import { LEVELS, ALL_COLOURS, mean, renderCell } from "./levels.js";

const DEFAULTS = Object.freeze({
  method: "diffuse",
  palette: ALL_COLOURS,
  toneWeight: 2,
  serpentine: true,
});

export function fitCell(target, { palette = ALL_COLOURS, toneWeight = 2 } = {}) {
  const targetMean = mean(target);
  let best = { bits: 0, fg: palette[0], bg: palette[0], cost: Infinity };
  for (let bits = 0; bits < 64; bits++) {
    const uniform = bits === 0 || bits === 63;
    for (const fg of palette) {
      for (const bg of palette) {
        if (uniform && fg !== bg) continue;
        let sse = 0;
        let sum = 0;
        for (let i = 0; i < 6; i++) {
          const level = LEVELS[(bits >> i) & 1 ? fg : bg];
          const d = target[i] - level;
          sse += d * d;
          sum += level;
        }
        const tone = sum / 6 - targetMean;
        const cost = sse + toneWeight * 6 * tone * tone;
        if (cost < best.cost) best = { bits, fg, bg, cost };
      }
    }
  }
  return best;
}

export function cellTarget({ width, data }, cx, cy) {
  const out = new Array(6);
  for (let dy = 0; dy < 3; dy++)
    for (let dx = 0; dx < 2; dx++)
      out[dy * 2 + dx] = data[(cy * 3 + dy) * width + cx * 2 + dx];
  return out;
}

function strip({ bits, fg, bg }) {
  return { bits, fg, bg };
}

function flat(field, options) {
  const cols = field.width / 2;
  const rows = field.height / 3;
  const cells = [];
  for (let cy = 0; cy < rows; cy++) {
    const line = [];
    for (let cx = 0; cx < cols; cx++) line.push(strip(fitCell(cellTarget(field, cx, cy), options)));
    cells.push(line);
  }
  return cells;
}

const METHODS = { flat };

export function quantise(field, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const method = METHODS[opts.method];
  if (!method) throw new Error(`Unknown method ${opts.method}`);
  return method(field, opts);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/quantise.test.js`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add image/quantise.js test/quantise.test.js
git commit -m "Add exhaustive mosaic cell fit with tone-weighted cost"
```

---

### Task 3: Error diffusion method

**Files:**
- Modify: `image/quantise.js`
- Test: `test/quantise.test.js`

**Interfaces:**
- Consumes: `fitCell`, `cellTarget`, `strip`, `METHODS` from Task 2.
- Produces: `quantise(field, { method: "diffuse", serpentine })`. `diffuse` becomes the default method.

- [ ] **Step 1: Write the failing tests**

Append to `test/quantise.test.js`:

```js
test("diffuse reproduces a mean tone that flat cannot", () => {
  const f = field(40, 24, () => 0.2);
  const diffused = quantise(f, { method: "diffuse" });
  const flatCells = quantise(f, { method: "flat" });
  const avg = (cells) => mean(cells.flat().map((c) => mean(renderCell(c))));
  assert.ok(Math.abs(avg(diffused) - 0.2) < 0.03, `diffuse mean ${avg(diffused)}`);
  assert.ok(Math.abs(avg(flatCells) - 0.2) > 0.1, `flat mean ${avg(flatCells)}`);
});

test("diffuse leaves an on-palette flat field untouched", () => {
  const f = field(8, 6, () => 0.7);
  for (const line of quantise(f, { method: "diffuse" }))
    for (const cell of line) assert.deepEqual(renderCell(cell), [0.7, 0.7, 0.7, 0.7, 0.7, 0.7]);
});

test("diffuse is deterministic and is the default method", () => {
  const f = field(20, 12, (x, y) => ((x * 7 + y * 13) % 17) / 17);
  assert.deepEqual(quantise(f), quantise(f, { method: "diffuse" }));
  assert.deepEqual(quantise(f, { serpentine: false }), quantise(f, { serpentine: false }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/quantise.test.js`
Expected: FAIL with `Unknown method diffuse`

- [ ] **Step 3: Write the implementation**

Add to `image/quantise.js` above `const METHODS` and register it:

```js
// Floyd-Steinberg with the neighbourhood in cell units: the residual of
// subpixel (dx, dy) lands on subpixel (dx, dy) of the neighbouring cells.
const SPREAD = [
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16],
  [0, 1, 5 / 16],
  [1, 1, 1 / 16],
];

function diffuse(field, options) {
  const { width, height } = field;
  const cols = width / 2;
  const rows = height / 3;
  const acc = { width, height, data: Float32Array.from(field.data) };
  const cells = Array.from({ length: rows }, () => new Array(cols));
  for (let cy = 0; cy < rows; cy++) {
    const reverse = options.serpentine && cy % 2 === 1;
    for (let k = 0; k < cols; k++) {
      const cx = reverse ? cols - 1 - k : k;
      const target = cellTarget(acc, cx, cy);
      const cell = strip(fitCell(target, options));
      cells[cy][cx] = cell;
      const got = renderCell(cell);
      for (let i = 0; i < 6; i++) {
        const err = target[i] - got[i];
        const dx = i % 2;
        const dy = (i - dx) / 2;
        for (const [ox, oy, weight] of SPREAD) {
          const nx = cx + (reverse ? -ox : ox);
          const ny = cy + oy;
          if (nx < 0 || nx >= cols || ny >= rows) continue;
          acc.data[(ny * 3 + dy) * width + nx * 2 + dx] += err * weight;
        }
      }
    }
  }
  return cells;
}

const METHODS = { flat, diffuse };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/quantise.test.js`
Expected: PASS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add image/quantise.js test/quantise.test.js
git commit -m "Add cell-level Floyd-Steinberg diffusion to the mosaic quantiser"
```

---

### Task 4: Bayer ordered dither method

**Files:**
- Modify: `image/quantise.js`
- Test: `test/quantise.test.js`

**Interfaces:**
- Consumes: `flat`, `METHODS` from Tasks 2 and 3.
- Produces: `quantise(field, { method: "bayer" })`.

- [ ] **Step 1: Write the failing tests**

Append to `test/quantise.test.js`:

```js
test("bayer leaves on-palette values unchanged", () => {
  const f = field(8, 6, (x) => (x < 4 ? 0.4 : 1));
  const cells = quantise(f, { method: "bayer", toneWeight: 0 });
  assert.deepEqual(renderCell(cells[0][0]), [0.4, 0.4, 0.4, 0.4, 0.4, 0.4]);
  assert.deepEqual(renderCell(cells[0][3]), [1, 1, 1, 1, 1, 1]);
});

test("bayer dithers a mid-gap value between its two neighbours", () => {
  const f = field(16, 12, () => 0.2);
  const cells = quantise(f, { method: "bayer", toneWeight: 0 });
  const values = new Set(cells.flat().flatMap((c) => renderCell(c)));
  assert.deepEqual([...values].sort(), [0, 0.4]);
  const avg = mean(cells.flat().map((c) => mean(renderCell(c))));
  assert.ok(Math.abs(avg - 0.2) < 0.05, `mean ${avg}`);
});

test("bayer respects the palette when bracketing", () => {
  const f = field(16, 12, () => 0.55);
  const cells = quantise(f, { method: "bayer", palette: [0, 7], toneWeight: 0 });
  for (const cell of cells.flat()) {
    assert.ok([0, 7].includes(cell.fg));
    assert.ok([0, 7].includes(cell.bg));
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/quantise.test.js`
Expected: FAIL with `Unknown method bayer`

- [ ] **Step 3: Write the implementation**

Add to `image/quantise.js` above `const METHODS` and register it:

```js
const BAYER8 = (() => {
  let m = [[0]];
  for (let n = 1; n < 8; n *= 2) {
    const next = [];
    for (let y = 0; y < n * 2; y++) {
      next.push([]);
      for (let x = 0; x < n * 2; x++) {
        const quadrant = (y >= n ? 2 : 0) + (x >= n ? 1 : 0);
        next[y].push(m[y % n][x % n] * 4 + [0, 2, 3, 1][quadrant]);
      }
    }
    m = next;
  }
  return m;
})();

function paletteLevels(palette) {
  return [...new Set(palette.map((i) => LEVELS[i]))].sort((a, b) => a - b);
}

function bayer(field, options) {
  const { width, height } = field;
  const levels = paletteLevels(options.palette);
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = field.data[y * width + x];
      let lo = levels[0];
      let hi = levels[levels.length - 1];
      for (let i = 0; i < levels.length - 1; i++) {
        if (v >= levels[i] && v <= levels[i + 1]) {
          lo = levels[i];
          hi = levels[i + 1];
          break;
        }
      }
      const position = hi === lo ? 0 : (v - lo) / (hi - lo);
      const threshold = (BAYER8[y % 8][x % 8] + 0.5) / 64;
      data[y * width + x] = position > threshold ? hi : lo;
    }
  }
  return flat({ width, height, data }, options);
}

const METHODS = { flat, diffuse, bayer };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/quantise.test.js`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```bash
git add image/quantise.js test/quantise.test.js
git commit -m "Add Bayer ordered dither to the mosaic quantiser"
```

---

### Task 5: Prepare stage with sharp

**Files:**
- Create: `image/prepare.js`
- Test: `test/prepare.test.js`

**Interfaces:**
- Produces: `prepare(source, cols, rows, { position, levels, gamma }) -> Promise<field>` and `stretch(data, lo, hi) -> Float32Array`. `source` is a path or Buffer.

- [ ] **Step 1: Write the failing tests**

```js
// test/prepare.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { prepare, stretch } from "../image/prepare.js";

async function png(width, height, fn, channels = 1) {
  const buf = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const px = fn(x, y);
      for (let c = 0; c < channels; c++) buf[(y * width + x) * channels + c] = px[c] ?? px;
    }
  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}

test("prepare returns a 2*cols by 3*rows field in [0, 1]", async () => {
  const src = await png(320, 240, (x) => Math.round((x / 319) * 255));
  const f = await prepare(src, 40, 24);
  assert.equal(f.width, 80);
  assert.equal(f.height, 72);
  assert.equal(f.data.length, 80 * 72);
  for (const v of f.data) assert.ok(v >= 0 && v <= 1);
});

test("prepare keeps a horizontal gradient monotonic and stretched", async () => {
  const src = await png(320, 240, (x) => 64 + Math.round((x / 319) * 128));
  const f = await prepare(src, 40, 24);
  const row = Array.from(f.data.slice(0, 80));
  for (let i = 1; i < row.length; i++) assert.ok(row[i] >= row[i - 1] - 0.01, `column ${i}`);
  assert.ok(row[0] < 0.02, `left ${row[0]}`);
  assert.ok(row[79] > 0.98, `right ${row[79]}`);
});

test("prepare centre-crops a wide image to the grid aspect", async () => {
  // 16:9 image: black left third, white middle third, black right third
  const src = await png(480, 270, (x) => (x >= 160 && x < 320 ? 255 : 0));
  const f = await prepare(src, 40, 24, { levels: false });
  // centre crop keeps 360 of 480 columns; the white band covers 160/360 = 44%
  const row = Array.from(f.data.slice(0, 80));
  const white = row.filter((v) => v > 0.5).length;
  assert.ok(white >= 33 && white <= 38, `white columns ${white}`);
  assert.ok(row[0] < 0.1 && row[79] < 0.1);
});

test("prepare flattens alpha onto black", async () => {
  const src = await sharp({ create: { width: 16, height: 12, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .png().toBuffer();
  const f = await prepare(src, 2, 1, { levels: false });
  for (const v of f.data) assert.equal(v, 0);
});

test("prepare upscales a small image", async () => {
  const src = await png(10, 10, () => 128);
  const f = await prepare(src, 40, 24, { levels: false });
  assert.equal(f.data.length, 80 * 72);
  assert.ok(Math.abs(f.data[0] - 0.5) < 0.02);
});

test("prepare applies gamma", async () => {
  const src = await png(16, 12, () => 128);
  const plain = await prepare(src, 2, 1, { levels: false });
  const dark = await prepare(src, 2, 1, { levels: false, gamma: 2 });
  assert.ok(Math.abs(dark.data[0] - plain.data[0] ** 2) < 1e-3);
});

test("stretch maps the 1st and 99th percentiles to 0 and 1", () => {
  const data = Float32Array.from({ length: 1000 }, (_, i) => 0.25 + (i / 999) * 0.5);
  const out = stretch(data);
  assert.ok(out[0] === 0);
  assert.ok(out[999] === 1);
  assert.ok(Math.abs(out[500] - 0.5) < 0.02);
});

test("stretch leaves a flat field unchanged", () => {
  const data = Float32Array.from({ length: 100 }, () => 0.5);
  const out = stretch(data);
  for (const v of out) assert.equal(v, 0.5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/prepare.test.js`
Expected: FAIL, cannot find module `../image/prepare.js`

- [ ] **Step 3: Write the implementation**

```js
// image/prepare.js
import sharp from "sharp";

export function stretch(data, lo = 0.01, hi = 0.99) {
  const sorted = Float32Array.from(data).sort();
  const a = sorted[Math.floor(lo * (sorted.length - 1))];
  const b = sorted[Math.floor(hi * (sorted.length - 1))];
  if (b - a < 1e-6) return Float32Array.from(data);
  return data.map((v) => Math.min(1, Math.max(0, (v - a) / (b - a))));
}

export async function prepare(source, cols, rows, { position = "centre", levels = true, gamma = 1 } = {}) {
  const width = cols * 2;
  const height = rows * 3;
  const raw = await sharp(source)
    .flatten({ background: "#000000" })
    .greyscale()
    .resize(cols * 8, rows * 10, { fit: "cover", position })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer();
  let data = Float32Array.from(raw, (v) => v / 255);
  if (levels) data = stretch(data);
  if (gamma !== 1) data = data.map((v) => v ** gamma);
  return { width, height, data };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/prepare.test.js`
Expected: PASS, 8 tests. If the crop test's white count falls outside the range, print `row` and adjust the bounds by at most 2 either way; lanczos edge ringing may shift one column.

- [ ] **Step 5: Commit**

```bash
git add image/prepare.js test/prepare.test.js
git commit -m "Add image prepare stage: crop to cell aspect, resample, auto levels"
```

---

### Task 6: Paint into a Screen and presets

**Files:**
- Create: `image/paint.js`, `image/presets.js`
- Test: `test/paint.test.js`, `test/presets.test.js`

**Interfaces:**
- Consumes: `Screen`, `encode` from `screen.js`; `ALL_COLOURS` from Task 1.
- Produces: `paint(screen, row, col, cells)`, `PRESETS` (frozen object of `{ method, palette, toneWeight }`), `preset(name) -> options` (throws on unknown).

- [ ] **Step 1: Write the failing tests**

```js
// test/paint.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { Screen, encode, DEFAULT_CELL } from "../screen.js";
import { paint } from "../image/paint.js";

const cells = [
  [{ bits: 1, fg: 7, bg: 0 }, { bits: 63, fg: 4, bg: 4 }],
  [{ bits: 0, fg: 2, bg: 2 }, { bits: 42, fg: 3, bg: 1 }],
];

test("paint writes mosaic cells at the requested origin", () => {
  const s = new Screen(24, 40);
  paint(s, 5, 10, cells);
  assert.deepEqual(s.get(5, 10), { ...DEFAULT_CELL, mosaic: true, char: 1, fg: 7, bg: 0 });
  assert.deepEqual(s.get(6, 11), { ...DEFAULT_CELL, mosaic: true, char: 42, fg: 3, bg: 1 });
  assert.deepEqual(s.get(5, 9), DEFAULT_CELL);
  assert.deepEqual(s.get(7, 10), DEFAULT_CELL);
});

test("paint clips outside the screen", () => {
  const s = new Screen(24, 40);
  paint(s, 24, 40, cells);
  assert.deepEqual(s.get(24, 40), { ...DEFAULT_CELL, mosaic: true, char: 1, fg: 7, bg: 0 });
});

test("painted cells encode to valid mosaic glyphs only", () => {
  const s = new Screen(2, 2);
  paint(s, 1, 1, cells);
  const out = encode(s);
  // skip position (0x1f + 2), attribute (0x1b + 1) and repeat (0x12 + 1) sequences
  const bytes = [...out].map((c) => c.charCodeAt(0));
  const payload = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x1b || bytes[i] === 0x1f || bytes[i] === 0x12) { i += bytes[i] === 0x1f ? 2 : 1; continue; }
    if (bytes[i] >= 0x20) payload.push(bytes[i]);
  }
  assert.ok(payload.length > 0);
  for (const g of payload) assert.ok((g >= 0x20 && g <= 0x3f) || (g >= 0x60 && g <= 0x7f), `glyph ${g.toString(16)}`);
});
```

```js
// test/presets.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, preset } from "../image/presets.js";

test("the five looks exist with the documented settings", () => {
  assert.deepEqual(Object.keys(PRESETS), ["photo", "poster", "halftone", "newsprint", "stencil"]);
  assert.equal(preset("photo").method, "diffuse");
  assert.equal(preset("photo").toneWeight, 2);
  assert.equal(preset("poster").method, "flat");
  assert.equal(preset("halftone").method, "bayer");
  assert.deepEqual([...preset("newsprint").palette], [0, 7]);
  assert.deepEqual([...preset("stencil").palette], [0, 4, 7]);
});

test("unknown preset throws", () => {
  assert.throws(() => preset("sepia"), /Unknown preset/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/paint.test.js test/presets.test.js`
Expected: FAIL, cannot find modules

- [ ] **Step 3: Write the implementations**

```js
// image/paint.js
export function paint(screen, row, col, cells) {
  cells.forEach((line, cy) => {
    line.forEach(({ bits, fg, bg }, cx) => {
      screen.set(row + cy, col + cx, { mosaic: true, char: bits, fg, bg });
    });
  });
}
```

```js
// image/presets.js
import { ALL_COLOURS } from "./levels.js";

export const PRESETS = Object.freeze({
  photo: Object.freeze({ method: "diffuse", palette: ALL_COLOURS, toneWeight: 2 }),
  poster: Object.freeze({ method: "flat", palette: ALL_COLOURS, toneWeight: 0 }),
  halftone: Object.freeze({ method: "bayer", palette: ALL_COLOURS, toneWeight: 0 }),
  newsprint: Object.freeze({ method: "diffuse", palette: Object.freeze([0, 7]), toneWeight: 2 }),
  stencil: Object.freeze({ method: "flat", palette: Object.freeze([0, 4, 7]), toneWeight: 0 }),
});

export function preset(name) {
  if (!Object.hasOwn(PRESETS, name)) throw new Error(`Unknown preset ${name}`);
  return PRESETS[name];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/paint.test.js test/presets.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add image/paint.js image/presets.js test/paint.test.js test/presets.test.js
git commit -m "Add mosaic paint helper and the five converter presets"
```

---

### Task 7: Option parsing and convert

**Files:**
- Create: `image/options.js`, `image/index.js`
- Test: `test/options.test.js`, `test/convert.test.js`

**Interfaces:**
- Consumes: `prepare` (Task 5), `quantise` (Tasks 2-4), `paint`, `PRESETS` (Task 6), `Screen`, `encode`.
- Produces: `OptionError`, `parseOptions(raw) -> { cols, rows, row, col, preset, position, levels, gamma, quantise: { method, palette, toneWeight } }` where `raw` values may be strings (query or CLI) or typed; `convert(source, raw) -> Promise<{ cells, field, bytes, options }>` with `bytes` a `Buffer`.

- [ ] **Step 1: Write the failing tests**

```js
// test/options.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOptions, OptionError } from "../image/options.js";

test("defaults fill the full screen with the photo preset", () => {
  const o = parseOptions({});
  assert.deepEqual(o, {
    cols: 40, rows: 24, row: 1, col: 1, preset: "photo", position: "centre", levels: true, gamma: 1,
    quantise: { method: "diffuse", palette: [0, 1, 2, 3, 4, 5, 6, 7], toneWeight: 2 },
  });
});

test("string values from a query are coerced", () => {
  const o = parseOptions({ cols: "20", rows: "12", row: "3", col: "5", preset: "stencil", tone: "1.5", levels: "false", gamma: "0.8", position: "top" });
  assert.equal(o.cols, 20);
  assert.equal(o.row, 3);
  assert.equal(o.levels, false);
  assert.equal(o.gamma, 0.8);
  assert.equal(o.position, "top");
  assert.deepEqual(o.quantise, { method: "flat", palette: [0, 4, 7], toneWeight: 1.5 });
});

test("method and palette override the preset", () => {
  const o = parseOptions({ preset: "photo", method: "bayer", palette: "7,0,7" });
  assert.equal(o.quantise.method, "bayer");
  assert.deepEqual(o.quantise.palette, [7, 0]);
});

test("garbage is rejected with OptionError", () => {
  for (const raw of [
    { cols: "abc" }, { cols: "0" }, { cols: "41" }, { rows: "25" }, { row: "0" }, { col: "41" },
    { preset: "nope" }, { method: "magic" }, { palette: "9" }, { palette: "a" }, { palette: "1,,2" },
    { tone: "-1" }, { tone: "x" }, { gamma: "0" }, { levels: "maybe" }, { position: "somewhere" },
  ]) {
    assert.throws(() => parseOptions(raw), OptionError, JSON.stringify(raw));
  }
});
```

```js
// test/convert.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { convert } from "../image/index.js";

async function gradient() {
  const buf = Buffer.alloc(320 * 240);
  for (let y = 0; y < 240; y++) for (let x = 0; x < 320; x++) buf[y * 320 + x] = Math.round((x / 319) * 255);
  return sharp(buf, { raw: { width: 320, height: 240, channels: 1 } }).png().toBuffer();
}

test("convert returns cells, field and a videotex buffer for the region", async () => {
  const { cells, field, bytes, options } = await convert(await gradient(), { cols: "10", rows: "4", row: 2, col: 3 });
  assert.equal(cells.length, 4);
  assert.equal(cells[0].length, 10);
  assert.equal(field.width, 20);
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(options.preset, "photo");
  // first row positions at row 2 col 3: 0x1f, 0x40+2, 0x40+3
  assert.deepEqual([...bytes.subarray(0, 3)], [0x1f, 0x42, 0x43]);
  // rows 1 and 6+ are untouched so nothing is emitted for them
  assert.equal(bytes.indexOf(Buffer.from([0x1f, 0x41])), -1);
});

test("every preset converts", async () => {
  const src = await gradient();
  for (const preset of ["photo", "poster", "halftone", "newsprint", "stencil"]) {
    const { bytes } = await convert(src, { preset, cols: 4, rows: 2 });
    assert.ok(bytes.length > 0, preset);
  }
});

test("convert rejects a non-image buffer", async () => {
  await assert.rejects(convert(Buffer.from("not an image"), { cols: 2, rows: 1 }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/options.test.js test/convert.test.js`
Expected: FAIL, cannot find modules

- [ ] **Step 3: Write the implementations**

```js
// image/options.js
import { PRESETS } from "./presets.js";

export class OptionError extends Error {}

const METHODS = ["flat", "diffuse", "bayer"];
const POSITIONS = ["centre", "top", "right", "bottom", "left", "entropy", "attention"];

function integer(raw, name, min, max, fallback) {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new OptionError(`${name} must be an integer between ${min} and ${max}`);
  }
  return n;
}

function positive(raw, name, fallback, { allowZero }) {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
    throw new OptionError(`${name} must be a ${allowZero ? "non-negative" : "positive"} number`);
  }
  return n;
}

function boolean(raw, name, fallback) {
  if (raw === undefined || raw === "") return fallback;
  if (raw === true || raw === "true" || raw === "1") return true;
  if (raw === false || raw === "false" || raw === "0") return false;
  throw new OptionError(`${name} must be true or false`);
}

function choice(raw, name, choices, fallback) {
  if (raw === undefined || raw === "") return fallback;
  if (!choices.includes(raw)) throw new OptionError(`${name} must be one of ${choices.join(", ")}`);
  return raw;
}

function palette(raw) {
  const items = Array.isArray(raw) ? raw : String(raw).split(",");
  const out = [];
  for (const item of items) {
    const n = Number(item);
    if (item === "" || !Number.isInteger(n) || n < 0 || n > 7) {
      throw new OptionError("palette must be a comma-separated list of colour indices 0 to 7");
    }
    if (!out.includes(n)) out.push(n);
  }
  if (out.length === 0) throw new OptionError("palette must not be empty");
  return out;
}

export function parseOptions(raw = {}) {
  const presetName = choice(raw.preset, "preset", Object.keys(PRESETS), "photo");
  const base = PRESETS[presetName];
  const quantise = {
    method: choice(raw.method, "method", METHODS, base.method),
    palette: raw.palette === undefined || raw.palette === "" ? [...base.palette] : palette(raw.palette),
    toneWeight: positive(raw.tone, "tone", base.toneWeight, { allowZero: true }),
  };
  return {
    cols: integer(raw.cols, "cols", 1, 40, 40),
    rows: integer(raw.rows, "rows", 1, 24, 24),
    row: integer(raw.row, "row", 1, 24, 1),
    col: integer(raw.col, "col", 1, 40, 1),
    preset: presetName,
    position: choice(raw.position, "position", POSITIONS, "centre"),
    levels: boolean(raw.levels, "levels", true),
    gamma: positive(raw.gamma, "gamma", 1, { allowZero: false }),
    quantise,
  };
}
```

```js
// image/index.js
import { Screen, encode } from "../screen.js";
import { prepare } from "./prepare.js";
import { quantise } from "./quantise.js";
import { paint } from "./paint.js";
import { parseOptions } from "./options.js";

export { prepare, quantise, paint, parseOptions };
export { OptionError } from "./options.js";
export { PRESETS, preset } from "./presets.js";

export async function convert(source, raw = {}) {
  const options = parseOptions(raw);
  const field = await prepare(source, options.cols, options.rows, {
    position: options.position,
    levels: options.levels,
    gamma: options.gamma,
  });
  const cells = quantise(field, options.quantise);
  const screen = new Screen(24, 40);
  paint(screen, options.row, options.col, cells);
  const bytes = Buffer.from(encode(screen), "latin1");
  return { cells, field, bytes, options };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all suites including the earlier ones

- [ ] **Step 5: Commit**

```bash
git add image/options.js image/index.js test/options.test.js test/convert.test.js
git commit -m "Add validated converter options and the convert entry point"
```

---

### Task 8: HTTP endpoint POST /api/vdt

**Files:**
- Create: `image/api.js`
- Modify: `server.js` (add import and route before the static mount)
- Test: `test/api.test.js`

**Interfaces:**
- Consumes: `convert`, `OptionError` from Task 7; `startServer` from `server.js`.
- Produces: `vdtHandler(req, res)` express handler; route `POST /api/vdt` accepting a raw image body up to 10 MB, query parameters as in `parseOptions` (`cols, rows, row, col, preset, method, palette, tone, levels, gamma, position`), responding `application/octet-stream` with header `X-Vdt-Bytes`, or 400 with a text message.

- [ ] **Step 1: Write the failing test**

```js
// test/api.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import sharp from "sharp";
import { startServer } from "../server.js";

let server;
let wss;
let base;

before(async () => {
  ({ server, wss } = startServer(() => {}, 0));
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  wss.close();
  await new Promise((resolve) => server.close(resolve));
});

async function grey() {
  return sharp({ create: { width: 32, height: 24, channels: 3, background: "#808080" } }).png().toBuffer();
}

test("returns a videotex stream for an image", async () => {
  const res = await fetch(`${base}/api/vdt?cols=4&rows=2&preset=poster`, { method: "POST", body: await grey() });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/octet-stream");
  const body = Buffer.from(await res.arrayBuffer());
  assert.equal(res.headers.get("x-vdt-bytes"), String(body.length));
  assert.equal(body[0], 0x1f);
});

test("rejects bad options with 400", async () => {
  const res = await fetch(`${base}/api/vdt?cols=abc`, { method: "POST", body: await grey() });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /cols/);
});

test("rejects an empty body", async () => {
  const res = await fetch(`${base}/api/vdt`, { method: "POST" });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /image/i);
});

test("rejects a non-image body", async () => {
  const res = await fetch(`${base}/api/vdt?cols=2&rows=1`, { method: "POST", body: "hello" });
  assert.equal(res.status, 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/api.test.js`
Expected: FAIL, status 404 instead of 200 (the route does not exist yet)

- [ ] **Step 3: Write the handler and mount it**

```js
// image/api.js
import { convert } from "./index.js";
import logger from "../logger.js";

export async function vdtHandler(req, res) {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).type("text").send("Request body must be an image");
    return;
  }
  try {
    const { bytes } = await convert(req.body, req.query);
    res.set("Content-Type", "application/octet-stream");
    res.set("X-Vdt-Bytes", String(bytes.length));
    res.send(bytes);
  } catch (error) {
    logger.warn(`[API] /api/vdt rejected: ${error.message}`);
    res.status(400).type("text").send(error.message);
  }
}
```

In `server.js`, add the import at the top:

```js
import { vdtHandler } from "./image/api.js";
```

and this line directly before `app.use(express.static(path.join(__dirname, "emulator")));`:

```js
  app.post("/api/vdt", express.raw({ type: () => true, limit: "10mb" }), vdtHandler);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. The api suite prints winston log lines to the console; that is expected.

- [ ] **Step 5: Commit**

```bash
git add image/api.js server.js test/api.test.js
git commit -m "Add POST /api/vdt endpoint converting an uploaded image to videotex"
```

---

### Task 9: Rewrite the CLI

**Files:**
- Modify: `bin/img2vdt.js` (replace the whole file)
- Test: `test/cli.test.js`

**Interfaces:**
- Consumes: `convert` from Task 7.
- Produces: `node bin/img2vdt.js <image> [--cols n] [--rows n] [--row n] [--col n] [--preset name] [--method m] [--palette 0,4,7] [--tone w] [--no-levels] [--gamma g] [--position p] [--out file]`. Writes the stream to `--out` or stdout, reports bytes and seconds on stderr, exits 1 with the message on error.

- [ ] **Step 1: Write the failing test**

```js
// test/cli.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const run = promisify(execFile);

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "img2vdt-"));
  const file = join(dir, "grey.png");
  await writeFile(file, await sharp({ create: { width: 32, height: 24, channels: 3, background: "#c0c0c0" } }).png().toBuffer());
  return { dir, file };
}

test("cli writes the stream to stdout and reports on stderr", async () => {
  const { file } = await fixture();
  const { stdout, stderr } = await run("node", ["bin/img2vdt.js", file, "--cols", "4", "--rows", "2", "--preset", "poster"], { encoding: "latin1" });
  assert.equal(stdout.charCodeAt(0), 0x1f);
  assert.match(stderr, /\d+ bytes, [\d.]+ s at 4800 baud/);
});

test("cli writes to --out", async () => {
  const { dir, file } = await fixture();
  const out = join(dir, "grey.vdt");
  await run("node", ["bin/img2vdt.js", file, "--cols", "4", "--rows", "2", "--out", out]);
  const bytes = await readFile(out);
  assert.equal(bytes[0], 0x1f);
});

test("cli exits 1 on a bad option", async () => {
  const { file } = await fixture();
  await assert.rejects(run("node", ["bin/img2vdt.js", file, "--cols", "abc"]), (err) => {
    assert.equal(err.code, 1);
    assert.match(err.stderr, /cols/);
    return true;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.js`
Expected: FAIL (the old script ignores the flags and prints its own usage or output)

- [ ] **Step 3: Replace bin/img2vdt.js**

```js
#!/usr/bin/env node
import { program } from "commander";
import { writeFile } from "node:fs/promises";
import { convert } from "../image/index.js";

program
  .name("img2vdt")
  .description("Convert a raster image to a greyscale Minitel videotex stream")
  .argument("<image>", "image file readable by sharp")
  .option("--cols <n>", "cell columns", "40")
  .option("--rows <n>", "cell rows", "24")
  .option("--row <n>", "screen row of the top-left cell", "1")
  .option("--col <n>", "screen column of the top-left cell", "1")
  .option("--preset <name>", "photo, poster, halftone, newsprint or stencil", "photo")
  .option("--method <name>", "flat, diffuse or bayer (overrides the preset)")
  .option("--palette <list>", "allowed colour indices, e.g. 0,4,7 (overrides the preset)")
  .option("--tone <weight>", "mean tone weight (overrides the preset)")
  .option("--no-levels", "skip percentile auto levels")
  .option("--gamma <g>", "gamma applied after levels", "1")
  .option("--position <p>", "crop anchor: centre, top, right, bottom, left, entropy, attention", "centre")
  .option("--out <file>", "write the stream to a file instead of stdout")
  .parse();

const opts = program.opts();
try {
  const { bytes } = await convert(program.args[0], {
    cols: opts.cols,
    rows: opts.rows,
    row: opts.row,
    col: opts.col,
    preset: opts.preset,
    method: opts.method,
    palette: opts.palette,
    tone: opts.tone,
    levels: opts.levels,
    gamma: opts.gamma,
    position: opts.position,
  });
  if (opts.out) await writeFile(opts.out, bytes);
  else process.stdout.write(bytes);
  console.error(`${bytes.length} bytes, ${(bytes.length / 480).toFixed(1)} s at 4800 baud`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/cli.test.js`
Expected: PASS, 3 tests

- [ ] **Step 5: Smoke test on a real photo**

Run: `node bin/img2vdt.js screens/omelette-large.png --out /tmp/omelette.vdt; echo exit $?`
Expected: a line like `2300 bytes, 4.8 s at 4800 baud` on stderr, `exit 0`, and a file of that size. Visual checks come with the playground in Task 10.

- [ ] **Step 6: Commit**

```bash
git add bin/img2vdt.js test/cli.test.js
git commit -m "Rewrite img2vdt CLI on the new converter with presets and placement"
```

---

### Task 10: Emulator socket opt-out and the playground page

**Files:**
- Modify: `emulator/library/minitel.js:4749-4760` (socket URL resolution)
- Create: `emulator/playground.html`

**Interfaces:**
- Consumes: `POST /api/vdt` from Task 8; `Minitel.startEmulators()`, `emulator.directSend(number[])`, `emulator.send(number[])` from the vendored emulator.
- Produces: `data-socket="none"` on `x-minitel` disables the websocket; `/playground.html` served by the existing static mount.

- [ ] **Step 1: Patch the emulator so `data-socket="none"` skips the websocket**

Replace the block in `emulator/library/minitel.js` that reads

```js
    let socketURL =
      urlParams.get("url") ||
      container.getAttribute("data-socket") ||
      undefined;
    if (
      !socketURL &&
      (location.protocol === "https:" || location.protocol === "http:")
    ) {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      socketURL = `${proto}//${location.host}`;
    }
```

with

```js
    let socketURL =
      urlParams.get("url") ||
      container.getAttribute("data-socket") ||
      undefined;
    if (socketURL === "none") {
      socketURL = undefined;
    } else if (
      !socketURL &&
      (location.protocol === "https:" || location.protocol === "http:")
    ) {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      socketURL = `${proto}//${location.host}`;
    }
```

- [ ] **Step 2: Write the playground page**

```html
<!-- emulator/playground.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>3615 image playground</title>
    <script src="library/utils.js"></script>
    <script src="library/minitel.js"></script>
    <style>
      body { margin: 0; padding: 16px; background: #202020; color: #ddd; font: 14px/1.4 system-ui, sans-serif; }
      main { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
      x-minitel { display: block; }
      canvas { image-rendering: pixelated; width: 640px; max-width: 100%; }
      form { display: grid; grid-template-columns: auto auto; gap: 6px 12px; align-items: center; }
      form label { justify-self: end; }
      input, select, button { font: inherit; }
      #drop { border: 2px dashed #555; padding: 24px; text-align: center; margin-bottom: 12px; }
      #drop.over { border-color: #ddd; }
      #status { margin-top: 12px; white-space: pre-wrap; }
      #actions { grid-column: 1 / -1; display: flex; gap: 8px; }
    </style>
  </head>
  <body>
    <main>
      <div>
        <div id="drop">Drop, paste or <label><input type="file" id="file" accept="image/*" /></label> an image</div>
        <x-minitel data-speed="4800" data-color="false" data-socket="none">
          <canvas class="minitel-screen" data-minitel="screen"></canvas>
        </x-minitel>
        <div id="status">No image yet.</div>
      </div>
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
        <input name="palette" id="palette" placeholder="preset default, e.g. 0,4,7" />
        <label for="tone">tone weight</label>
        <input name="tone" id="tone" type="number" min="0" step="0.5" placeholder="preset default" />
        <label for="levels">auto levels</label>
        <input name="levels" id="levels" type="checkbox" checked />
        <label for="gamma">gamma</label>
        <input name="gamma" id="gamma" type="number" min="0.1" step="0.1" value="1" />
        <label for="position">crop anchor</label>
        <select name="position" id="position">
          <option>centre</option><option>top</option><option>bottom</option><option>left</option><option>right</option><option>attention</option><option>entropy</option>
        </select>
        <label for="cols">cols</label>
        <input name="cols" id="cols" type="number" min="1" max="40" value="40" />
        <label for="rows">rows</label>
        <input name="rows" id="rows" type="number" min="1" max="24" value="24" />
        <label for="row">row</label>
        <input name="row" id="row" type="number" min="1" max="24" value="1" />
        <label for="col">col</label>
        <input name="col" id="col" type="number" min="1" max="40" value="1" />
        <div id="actions">
          <button type="button" id="replay">replay at 4800 baud</button>
        </div>
      </form>
    </main>
    <script>
      const [emulator] = Minitel.startEmulators();
      const form = document.getElementById("settings");
      const status = document.getElementById("status");
      const drop = document.getElementById("drop");
      let image = null;
      let bytes = null;

      function query() {
        const data = new FormData(form);
        const q = new URLSearchParams();
        for (const [key, value] of data) if (value !== "" && key !== "levels") q.set(key, value);
        q.set("levels", data.has("levels") ? "true" : "false");
        return q;
      }

      async function convert() {
        if (!image) return;
        status.textContent = "Converting…";
        const res = await fetch(`/api/vdt?${query()}`, { method: "POST", body: image.buffer });
        if (!res.ok) {
          status.textContent = `Error: ${await res.text()}`;
          return;
        }
        bytes = Array.from(new Uint8Array(await res.arrayBuffer()));
        status.textContent = `${image.name}: ${bytes.length} bytes, ${(bytes.length / 480).toFixed(1)} s at 4800 baud`;
        emulator.directSend([0x0c, ...bytes]);
      }

      function load(file) {
        if (!file || !file.type.startsWith("image/")) return;
        file.arrayBuffer().then((buffer) => {
          image = { name: file.name || "pasted image", buffer };
          convert();
        });
      }

      document.getElementById("file").addEventListener("change", (e) => load(e.target.files[0]));
      document.addEventListener("paste", (e) => {
        const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
        if (item) load(item.getAsFile());
      });
      document.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
      document.addEventListener("dragleave", () => drop.classList.remove("over"));
      document.addEventListener("drop", (e) => {
        e.preventDefault();
        drop.classList.remove("over");
        load(e.dataTransfer.files[0]);
      });
      form.addEventListener("change", convert);
      document.getElementById("replay").addEventListener("click", () => {
        if (!bytes) return;
        emulator.directSend([0x0c]);
        emulator.send(bytes);
      });
    </script>
  </body>
</html>
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `http://localhost:3615/playground.html`.

Check, in order:
1. The browser console shows no websocket connection attempt and no errors.
2. Dropping `screens/omelette-large.png` renders the image in the emulator canvas and the status line shows a byte count.
3. Switching preset to `stencil` re-renders with three tones; `newsprint` renders black and white.
4. Setting cols 20, rows 12, row 7, col 11 renders a centred quarter-size image.
5. Pasting an image from the clipboard works.
6. "replay at 4800 baud" clears and redraws progressively over several seconds.
7. Typing `abc` in cols shows an error in the status line rather than breaking the page.

Also open `http://localhost:3615/` and confirm the normal emulator still connects (the status row should not show the disconnected marker).

- [ ] **Step 4: Commit**

```bash
git add emulator/library/minitel.js emulator/playground.html
git commit -m "Add image playground page rendering through the emulator without a socket"
```

---

### Task 11: Docs and devlog

**Files:**
- Modify: `README.md` (add a section after "Deploy")
- Modify: `~/code/meta-repo/3615/image-to-videotex/execution-log.md`, copy plan to `~/code/meta-repo/3615/image-to-videotex/plan.md`

- [ ] **Step 1: Add the README section**

Insert after the "Uninstall" block and before "## Notes":

````markdown
## Image converter

`image/` turns a raster image into greyscale mosaic cells. Five looks are available as presets: `photo` (error diffusion), `poster` (no dither), `halftone` (Bayer), `newsprint` (black and white diffusion) and `stencil` (three tones).

Command line:

```sh
node bin/img2vdt.js photo.jpg --preset photo --cols 40 --rows 24 --out screens/photo.vdt
```

Playground: run `npm run dev` and open `http://localhost:3615/playground.html`. Drop, paste or pick an image, change settings and watch the result in the emulator. "Replay at 4800 baud" shows the reveal at link speed. The page uses `POST /api/vdt`, which takes a raw image body and the same options as the CLI as query parameters.
````

- [ ] **Step 2: Run the full suite one last time**

Run: `npm test`
Expected: PASS, all suites

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document the image converter CLI and playground"
```

- [ ] **Step 4: Update the meta-repo**

```bash
cp docs/superpowers/plans/2026-09-27-image-to-videotex.md ~/code/meta-repo/3615/image-to-videotex/plan.md
```

Append to `~/code/meta-repo/3615/image-to-videotex/execution-log.md` a dated entry listing the commits made, anything that deviated from the plan, and what the playground showed. Commit in the meta-repo with only those two paths:

```bash
cd ~/code/meta-repo && git add 3615/image-to-videotex/plan.md 3615/image-to-videotex/execution-log.md && git commit -m "docs: 3615 image to videotex plan and execution log"
```
