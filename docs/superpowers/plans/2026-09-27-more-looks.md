# More Looks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four looks chosen from the exploration probe: blue-noise dither, stripe dots, an edges filter, and text-glyph rendering, as shared code used by node, the CLI, the endpoint and the playground.

**Architecture:** Two new quantise methods (`noise`, `dot`) join `flat`, `diffuse` and `bayer` in `image/quantise.js`, with the ordered-dither loop factored so Bayer and blue noise share it; the blue-noise matrix lives in `image/noise.js`. An `edges` transform joins the pure field core. Text rendering is a separate pure module, `image/text.js`, matching 8 by 10 blocks against glyph bitmaps in a generated `image/glyphs.js`; `paint` accepts text cells. The prepare front ends take a cell size so text mode samples 8 by 10 per cell. A new pure `image/pipeline.js` holds the branching (cell size by method, filter, mosaic versus text) so `convert` and the playground share it. Presets gain `stripes`, `sketch`, `typewriter`; `newsprint` moves to blue noise.

**Tech Stack:** Node 22 ESM, `node --test`, sharp (only for prepare and the glyph extraction script), the vendored emulator font sheet `emulator/font/ef9345-g0.png`.

**Spec:** `docs/superpowers/specs/2026-09-27-image-to-videotex-design.md` plus the design agreed in chat on 2026-09-27 (this plan's Architecture paragraph).

## Global Constraints

- ESM, Node 22, two-space indent, double quotes, semicolons. Tests in `test/*.test.js`, suite must stay green (110 now).
- Mosaic cells are `{ bits, fg, bg }`; text cells are `{ char, fg, bg }` with `char` a one-character ASCII string 0x20 to 0x7E. `paint` tells them apart by the presence of `char`.
- Cell size: mosaic samples `2 x 3` subpixels per cell, text samples `8 x 10`. A field is `{ width, height, data }` with `width = cols * cellW`, `height = rows * cellH`.
- Glyph bitmaps: 95 glyphs for chars 0x20 to 0x7E, each 10 rows of 8 pixels, a row encoded as one byte with bit 7 the leftmost pixel. Regenerated from the font sheet by `bin/extract-glyphs.js`.
- Blue-noise matrix: 64 by 64, void-and-cluster, fixed seed, generated lazily on first use, thresholds `(rank + 0.5) / 4096`.
- Dot growth order within a cell, by subpixel index: `[2, 3, 0, 5, 1, 4]`.
- The endpoint and CLI accept the new `method` values and a `filter` query/flag. Existing presets other than `newsprint` are unchanged.
- Never touch unrelated code. Commit after each task. No AI co-author lines.

## Review Focus

1. Text mode with a palette that contains only black must not produce invisible text; pinned in Task 3 (`matchGlyphs ignores black as ink`).
2. `dot` with a single-grey palette must not divide by zero; pinned in Task 2 (`dot with one grey paints flat cells`).
3. `edges` on a flat field must return zeros, not NaN; pinned in Task 1 (`edges of a flat field is zero`).
4. The endpoint must accept `method=text` and `filter=edges` and reject `filter=blur`; pinned in Task 4 (options tests) and Task 4 (`convert renders text cells`).
5. Text cells must encode without ever emitting a background attribute (which would need the space rule); pinned in Task 3 (`text cells encode with foreground only`).

---

### Task 1: Edges filter in the field core

**Files:** Modify `image/field.js`; Test `test/field.test.js`.

**Interfaces:** Produces `edges(field) -> field` of the same size: 3 by 3 Gaussian blur, Sobel magnitude, normalised by the 98th percentile and clipped to `[0, 1]`.

- [ ] **Step 1: Failing tests** (append to `test/field.test.js`, import `edges`)

```js
function fieldOf(width, height, fn) {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = fn(x, y);
  return { width, height, data };
}

test("edges lights a vertical step and nothing far from it", () => {
  const f = edges(fieldOf(40, 12, (x) => (x < 20 ? 0 : 1)));
  assert.equal(f.width, 40);
  const row = (x) => f.data[6 * 40 + x];
  assert.ok(row(19) > 0.9 && row(20) > 0.9, `edge ${row(19)} ${row(20)}`);
  assert.ok(row(5) < 0.05 && row(35) < 0.05, `flat ${row(5)} ${row(35)}`);
  for (const v of f.data) assert.ok(v >= 0 && v <= 1);
});

test("edges of a flat field is zero", () => {
  const f = edges(fieldOf(16, 12, () => 0.5));
  for (const v of f.data) assert.equal(v, 0);
});
```

- [ ] **Step 2: Run** `node --test test/field.test.js` → FAIL, `edges` is not exported.
- [ ] **Step 3: Implement** (append to `image/field.js`)

```js
function convolve3({ width, height, data }, kernel) {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(width - 1, Math.max(0, x + dx));
          const yy = Math.min(height - 1, Math.max(0, y + dy));
          sum += data[yy * width + xx] * kernel[(dy + 1) * 3 + dx + 1];
        }
      }
      out[y * width + x] = sum;
    }
  }
  return { width, height, data: out };
}

const GAUSS = [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v / 16);
const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

// Gradient magnitude of the blurred field, normalised so the 98th percentile is 1.
export function edges(field) {
  const smooth = convolve3(field, GAUSS);
  const gx = convolve3(smooth, SOBEL_X).data;
  const gy = convolve3(smooth, SOBEL_Y).data;
  const magnitude = new Float32Array(gx.length);
  for (let i = 0; i < gx.length; i++) magnitude[i] = Math.hypot(gx[i], gy[i]);
  const sorted = Float32Array.from(magnitude).sort();
  const top = sorted[Math.floor(0.98 * (sorted.length - 1))];
  const data = top > 0 ? magnitude.map((v) => Math.min(1, v / top)) : magnitude;
  return { width: field.width, height: field.height, data };
}
```

- [ ] **Step 4: Run** `node --test test/field.test.js` → PASS (11 tests). **Step 5: Commit** `git add image/field.js test/field.test.js && git commit -m "Add edges filter to the field core"`.

---

### Task 2: Blue noise and dot methods

**Files:** Create `image/noise.js`; Modify `image/quantise.js`; Test `test/noise.test.js`, `test/quantise.test.js`.

**Interfaces:** `blueNoise() -> (x, y) => threshold` (cached 64 by 64 matrix); `quantise(field, { method: "noise" | "dot" })`.

- [ ] **Step 1: Failing tests**

`test/noise.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { blueNoise, SIZE } from "../image/noise.js";

test("blue noise thresholds are a permutation of the 4096 levels", () => {
  const t = blueNoise();
  const values = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) values.push(t(x, y));
  values.sort((a, b) => a - b);
  for (let i = 0; i < values.length; i++) assert.ok(Math.abs(values[i] - (i + 0.5) / (SIZE * SIZE)) < 1e-6, `rank ${i}`);
});

test("blue noise is evenly spread: every 8x8 tile is about half below 0.5", () => {
  const t = blueNoise();
  for (let ty = 0; ty < SIZE; ty += 8) for (let tx = 0; tx < SIZE; tx += 8) {
    let dark = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (t(tx + x, ty + y) < 0.5) dark++;
    assert.ok(dark >= 24 && dark <= 40, `tile ${tx},${ty} has ${dark}`);
  }
});

test("blue noise tiles and is cached", () => {
  const t = blueNoise();
  assert.equal(t(3, 5), t(3 + SIZE, 5 + SIZE));
  assert.equal(blueNoise(), t);
});
```

Append to `test/quantise.test.js`:
```js
test("noise dithers a mid-gap value between its neighbours with an even mean", () => {
  const f = field(64, 48, () => 0.2);
  const cells = quantise(f, { method: "noise", toneWeight: 0 });
  const values = new Set(cells.flat().flatMap((c) => renderCell(c)));
  assert.deepEqual([...values].sort(), [0, 0.4]);
  const avg = mean(cells.flat().map((c) => mean(renderCell(c))));
  assert.ok(Math.abs(avg - 0.2) < 0.03, `mean ${avg}`);
});

test("dot grows ink in the fixed order from paper to full", () => {
  const tones = [1, 0.8, 0.65, 0.5, 0.35, 0.2, 0];
  const f = field(14, 3, (x) => tones[Math.floor(x / 2)]);
  const cells = quantise(f, { method: "dot", palette: [0, 7] });
  const expected = [0, 0b000100, 0b001100, 0b001101, 0b101101, 0b101111, 0b111111];
  cells[0].forEach((cell, i) => {
    assert.equal(cell.bits, expected[i], `tone ${tones[i]}`);
    assert.equal(cell.fg, 0);
    assert.equal(cell.bg, 7);
  });
});

test("dot uses the darkest and lightest greys of the palette", () => {
  const f = field(2, 3, () => 0.5);
  const [[cell]] = quantise(f, { method: "dot", palette: [4, 2, 6] });
  assert.equal(cell.fg, 4);
  assert.equal(cell.bg, 6);
});

test("dot with one grey paints flat cells", () => {
  const f = field(4, 3, () => 0.5);
  for (const cell of quantise(f, { method: "dot", palette: [2] })[0]) assert.deepEqual(cell, { bits: 0, fg: 2, bg: 2 });
});
```

- [ ] **Step 2: Run** both files → FAIL (module missing, `Unknown method noise`).
- [ ] **Step 3: Implement**

`image/noise.js`:
```js
export const SIZE = 64;
const SIGMA = 1.9;
let cached = null;

// Void-and-cluster (Ulichney) with a fixed seed, so every run gets the same matrix.
function generate() {
  const n = SIZE * SIZE;
  const kernel = new Float32Array(n);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = Math.min(x, SIZE - x);
      const dy = Math.min(y, SIZE - y);
      kernel[y * SIZE + x] = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
    }
  }
  const energy = new Float32Array(n);
  const pattern = new Uint8Array(n);
  const toggle = (i, on) => {
    pattern[i] = on ? 1 : 0;
    const px = i % SIZE;
    const py = (i - px) / SIZE;
    for (let y = 0; y < SIZE; y++) {
      const ky = ((y - py + SIZE) % SIZE) * SIZE;
      for (let x = 0; x < SIZE; x++) {
        const k = kernel[ky + ((x - px + SIZE) % SIZE)];
        energy[y * SIZE + x] += on ? k : -k;
      }
    }
  };
  const extreme = (on) => {
    let best = -1;
    let value = on ? -Infinity : Infinity;
    for (let i = 0; i < n; i++) {
      if (pattern[i] !== (on ? 1 : 0)) continue;
      if (on ? energy[i] > value : energy[i] < value) { value = energy[i]; best = i; }
    }
    return best;
  };
  let seed = 12345;
  const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const initial = Math.floor(n / 10);
  let count = 0;
  while (count < initial) {
    const i = Math.floor(random() * n);
    if (!pattern[i]) { toggle(i, true); count++; }
  }
  for (let iter = 0; iter < 2000; iter++) {
    const cluster = extreme(true);
    toggle(cluster, false);
    const voidSpot = extreme(false);
    toggle(voidSpot, true);
    if (voidSpot === cluster) break;
  }
  const rank = new Int32Array(n);
  const savedPattern = Uint8Array.from(pattern);
  const savedEnergy = Float32Array.from(energy);
  for (let r = initial - 1; r >= 0; r--) { const i = extreme(true); rank[i] = r; toggle(i, false); }
  pattern.set(savedPattern);
  energy.set(savedEnergy);
  for (let r = initial; r < n; r++) { const i = extreme(false); rank[i] = r; toggle(i, true); }
  const thresholds = new Float32Array(n);
  for (let i = 0; i < n; i++) thresholds[i] = (rank[i] + 0.5) / n;
  return thresholds;
}

export function blueNoise() {
  if (!cached) {
    const t = generate();
    cached = (x, y) => t[(y % SIZE) * SIZE + (x % SIZE)];
  }
  return cached;
}
```

In `image/quantise.js`: import `blueNoise`; replace `bayer` by an `ordered(field, options, threshold)` helper plus `bayer = (f, o) => ordered(f, o, (x, y) => (BAYER8[y % 8][x % 8] + 0.5) / 64)` and `noise = (f, o) => ordered(f, o, blueNoise())`; add:

```js
const GROWTH = [2, 3, 0, 5, 1, 4];
const DOT_PATTERNS = Array.from({ length: 7 }, (_, k) => GROWTH.slice(0, k).reduce((bits, i) => bits | (1 << i), 0));

// Stripe dots: ink grows in a fixed order as the cell darkens, between the palette's extremes.
function dot(field, options) {
  const byLevel = [...options.palette].sort((a, b) => LEVELS[a] - LEVELS[b]);
  const ink = byLevel[0];
  const paper = byLevel[byLevel.length - 1];
  const range = LEVELS[paper] - LEVELS[ink];
  return grid(field, (target) => {
    if (range === 0) return { bits: 0, fg: ink, bg: ink };
    const k = Math.round(((LEVELS[paper] - mean(target)) / range) * 6);
    return { bits: DOT_PATTERNS[Math.min(6, Math.max(0, k))], fg: ink, bg: paper };
  });
}
```
where `grid(field, fn)` is a small helper that maps every cell target through `fn` (refactor `flat` to use it). Register `METHODS = { flat, diffuse, bayer, noise, dot }`.

- [ ] **Step 4: Run** `npm test` → PASS. **Step 5: Commit** `git add image/noise.js image/quantise.js test/noise.test.js test/quantise.test.js && git commit -m "Add blue-noise and stripe-dot quantise methods"`.

---

### Task 3: Glyph table, text matching, text cells in paint

**Files:** Create `bin/extract-glyphs.js`, `image/glyphs.js` (generated), `image/text.js`; Modify `image/paint.js`; Test `test/glyphs.test.js`, `test/text.test.js`, `test/paint.test.js`.

**Interfaces:** `GLYPHS` (object char → `number[10]` rows, bit 7 leftmost); `matchGlyphs(field, { palette }) -> cells[rows][cols]` of `{ char, fg, bg: 0 }` for an 8 by 10 per cell field; `paint` accepts text cells.

- [ ] **Step 1: Failing tests**

`test/glyphs.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { GLYPHS } from "../image/glyphs.js";

test("glyph table covers the 95 printable ASCII characters", () => {
  const chars = Object.keys(GLYPHS);
  assert.equal(chars.length, 95);
  assert.equal(chars[0], " ");
  assert.equal(chars[94], "~");
  for (const rows of Object.values(GLYPHS)) {
    assert.equal(rows.length, 10);
    for (const row of rows) assert.ok(Number.isInteger(row) && row >= 0 && row <= 255);
  }
});

test("A matches the emulator font, bit 7 is the leftmost pixel", () => {
  assert.deepEqual(GLYPHS["A"], [0x00, 0x38, 0x44, 0x44, 0x44, 0x7c, 0x44, 0x44, 0x00, 0x00]);
  assert.deepEqual(GLYPHS[" "], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});
```

`test/text.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchGlyphs } from "../image/text.js";
import { GLYPHS } from "../image/glyphs.js";

function fieldFromGlyphs(chars, level) {
  const width = chars.length * 8, height = 10;
  const data = new Float32Array(width * height);
  chars.forEach((ch, c) => GLYPHS[ch].forEach((row, y) => { for (let x = 0; x < 8; x++) if (row & (0x80 >> x)) data[y * width + c * 8 + x] = level; }));
  return { width, height, data };
}

test("matchGlyphs recovers exact glyphs and their grey", () => {
  const cells = matchGlyphs(fieldFromGlyphs(["A", "#", " "], 0.7));
  assert.deepEqual(cells[0].map((c) => c.char), ["A", "#", " "]);
  assert.equal(cells[0][0].fg, 2);
  assert.equal(cells[0][0].bg, 0);
});

test("matchGlyphs ignores black as ink", () => {
  const cells = matchGlyphs(fieldFromGlyphs(["A"], 1), { palette: [0] });
  assert.equal(cells[0][0].char, "A");
  assert.equal(cells[0][0].fg, 7);
});

test("matchGlyphs restricts ink to the palette", () => {
  const cells = matchGlyphs(fieldFromGlyphs(["A"], 0.7), { palette: [0, 4, 7] });
  assert.ok([4, 7].includes(cells[0][0].fg));
});
```

Append to `test/paint.test.js`:
```js
test("paint writes text cells with a black background", () => {
  const s = new Screen(24, 40);
  paint(s, 3, 4, [[{ char: "A", fg: 2, bg: 0 }]]);
  assert.deepEqual(s.get(3, 4), { ...DEFAULT_CELL, char: "A", fg: 2, bg: 0, mosaic: false });
});

test("text cells encode with foreground only", () => {
  const s = new Screen(1, 3);
  paint(s, 1, 1, [[{ char: "A", fg: 2, bg: 0 }, { char: "B", fg: 7, bg: 0 }, { char: " ", fg: 3, bg: 0 }]]);
  const out = encode(s);
  assert.ok(!out.includes("\x1bP") && !out.includes("\x1bW"), "no background attribute");
  assert.ok(out.includes("\x1bB") && out.includes("A"));
});
```

- [ ] **Step 2: Run** → FAIL (modules missing).
- [ ] **Step 3: Implement**

`bin/extract-glyphs.js` (run once with `node bin/extract-glyphs.js`, commit its output):
```js
#!/usr/bin/env node
// Extracts the 95 printable glyphs from the emulator's G0 font sheet into image/glyphs.js.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { data, info } = await sharp(join(root, "emulator/font/ef9345-g0.png")).raw().toBuffer({ resolveWithObject: true });
const lines = ["// Generated by bin/extract-glyphs.js from emulator/font/ef9345-g0.png. Do not edit.", "export const GLYPHS = {"];
for (let code = 0x20; code <= 0x7e; code++) {
  const x0 = Math.floor(code / 16) * 8;
  const y0 = (code % 16) * 10;
  const rows = [];
  for (let y = 0; y < 10; y++) {
    let row = 0;
    for (let x = 0; x < 8; x++) {
      const o = ((y0 + y) * info.width + x0 + x) * 4;
      if (data[o + 3] > 0 && data[o] > 127) row |= 0x80 >> x;
    }
    rows.push(`0x${row.toString(16).padStart(2, "0")}`);
  }
  lines.push(`  ${JSON.stringify(String.fromCharCode(code))}: [${rows.join(", ")}],`);
}
lines.push("};", "");
await writeFile(join(root, "image/glyphs.js"), lines.join("\n"));
console.error("wrote image/glyphs.js");
```

`image/text.js`:
```js
import { GLYPHS } from "./glyphs.js";
import { LEVELS, ALL_COLOURS } from "./levels.js";

const ENTRIES = Object.entries(GLYPHS).map(([char, rows]) => {
  const on = [];
  rows.forEach((row, y) => { for (let x = 0; x < 8; x++) if (row & (0x80 >> x)) on.push(y * 8 + x); });
  return { char, on };
});

// Match each 8x10 block against every glyph with grey ink on black, by squared error.
export function matchGlyphs(field, { palette = ALL_COLOURS } = {}) {
  const inks = palette.filter((i) => LEVELS[i] > 0);
  if (inks.length === 0) inks.push(7);
  const cols = field.width / 8;
  const rows = field.height / 10;
  const block = new Float32Array(80);
  const cells = [];
  for (let cy = 0; cy < rows; cy++) {
    const line = [];
    for (let cx = 0; cx < cols; cx++) {
      let squares = 0;
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 8; x++) {
          const v = field.data[(cy * 10 + y) * field.width + cx * 8 + x];
          block[y * 8 + x] = v;
          squares += v * v;
        }
      }
      let best = { cost: Infinity, char: " ", fg: inks[0] };
      for (const { char, on } of ENTRIES) {
        let onSum = 0;
        for (const i of on) onSum += block[i];
        for (const fg of inks) {
          const f = LEVELS[fg];
          const cost = squares - 2 * f * onSum + on.length * f * f;
          if (cost < best.cost - 1e-12) best = { cost, char, fg };
        }
      }
      line.push({ char: best.char, fg: best.fg, bg: 0 });
    }
    cells.push(line);
  }
  return cells;
}
```

`image/paint.js`:
```js
export function paint(screen, row, col, cells) {
  cells.forEach((line, cy) => {
    line.forEach((cell, cx) => {
      const value = "char" in cell
        ? { char: cell.char, fg: cell.fg, bg: cell.bg, mosaic: false }
        : { mosaic: true, char: cell.bits, fg: cell.fg, bg: cell.bg };
      screen.set(row + cy, col + cx, value);
    });
  });
}
```

- [ ] **Step 4: Run** `node bin/extract-glyphs.js && npm test` → PASS. **Step 5: Commit** `git add bin/extract-glyphs.js image/glyphs.js image/text.js image/paint.js test/glyphs.test.js test/text.test.js test/paint.test.js && git commit -m "Add text glyph matching with a generated font table"`.

---

### Task 4: Cell size in prepare, pipeline, options, presets, convert, CLI

**Files:** Create `image/pipeline.js`; Modify `image/prepare.js`, `image/prepare-browser.js`, `image/options.js`, `image/presets.js`, `image/index.js`, `bin/img2vdt.js`; Test `test/prepare.test.js`, `test/options.test.js`, `test/presets.test.js`, `test/convert.test.js`, `test/pipeline.test.js`.

**Interfaces:**
- `prepare(source, cols, rows, { ..., cell = [2, 3] })` and `prepareCanvas(source, cols, rows, { ..., cell = [2, 3] })`.
- `image/pipeline.js`: `cellSize(method) -> [w, h]` (text → `[8, 10]`, else `[2, 3]`); `applyFilter(field, filter) -> field` (`none` passthrough, `edges`); `toCells(field, quantiseOptions) -> cells` (text → `matchGlyphs`, else `quantise`).
- `parseOptions` returns `filter` (`"none" | "edges"`) at top level and accepts `method` in `flat, diffuse, bayer, noise, dot, text`.
- Presets: `{ method, palette, toneWeight, filter }`; `newsprint = { noise, [0,7], 0, none }`, `stripes = { dot, [0,7], 0, none }`, `sketch = { flat, all, 0, edges }`, `typewriter = { text, all, 0, none }`; existing presets get `filter: "none"`.
- `convert` uses the pipeline. CLI gains `--filter <name>`.

- [ ] **Step 1: Failing tests**

Append to `test/prepare.test.js`:
```js
test("prepare samples 8x10 per cell when asked", async () => {
  const src = await png(320, 240, (x) => Math.round((x / 319) * 255));
  const f = await prepare(src, 40, 24, { cell: [8, 10] });
  assert.equal(f.width, 320);
  assert.equal(f.height, 240);
});
```

`test/pipeline.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { cellSize, applyFilter, toCells } from "../image/pipeline.js";

test("cellSize is 8x10 for text and 2x3 otherwise", () => {
  assert.deepEqual(cellSize("text"), [8, 10]);
  assert.deepEqual(cellSize("diffuse"), [2, 3]);
});

test("applyFilter passes through none and transforms edges", () => {
  const field = { width: 16, height: 6, data: new Float32Array(96).map((_, i) => (i % 16 < 8 ? 0 : 1)) };
  assert.equal(applyFilter(field, "none"), field);
  const e = applyFilter(field, "edges");
  assert.ok(e.data[7] > 0.5 && e.data[0] < 0.1);
  assert.throws(() => applyFilter(field, "blur"), /filter/);
});

test("toCells dispatches to text or mosaic", () => {
  const mosaic = toCells({ width: 4, height: 3, data: new Float32Array(12).fill(1) }, { method: "flat", palette: [0, 7], toneWeight: 0 });
  assert.ok("bits" in mosaic[0][0]);
  const text = toCells({ width: 16, height: 10, data: new Float32Array(160) }, { method: "text", palette: [0, 7], toneWeight: 0 });
  assert.ok("char" in text[0][0]);
  assert.equal(text[0].length, 2);
});
```

`test/options.test.js`: extend the defaults test's expected object with `filter: "none"`; add:
```js
test("new methods and the filter are accepted", () => {
  for (const method of ["noise", "dot", "text"]) assert.equal(parseOptions({ method }).quantise.method, method);
  assert.equal(parseOptions({ filter: "edges" }).filter, "edges");
  assert.equal(parseOptions({ preset: "sketch" }).filter, "edges");
  assert.equal(parseOptions({ preset: "sketch", filter: "none" }).filter, "none");
  assert.throws(() => parseOptions({ filter: "blur" }), OptionError);
});
```

`test/presets.test.js`: update the key list to `["photo", "poster", "halftone", "newsprint", "stencil", "stripes", "sketch", "typewriter"]`, assert `preset("newsprint").method === "noise"`, `preset("stripes").method === "dot"`, `preset("sketch").filter === "edges"`, `preset("typewriter").method === "text"`, and every preset has a `filter`.

`test/convert.test.js`: add
```js
test("convert renders text cells", async () => {
  const { cells, bytes, field } = await convert(await gradient(), { method: "text", cols: 4, rows: 2 });
  assert.equal(field.width, 32);
  assert.ok("char" in cells[0][0]);
  assert.ok(bytes.length > 0);
});

test("convert accepts a filter", async () => {
  const { bytes } = await convert(await gradient(), { preset: "sketch", cols: 4, rows: 2 });
  assert.ok(bytes.length > 0);
});
```

- [ ] **Step 2: Run** `npm test` → FAIL on the new tests.
- [ ] **Step 3: Implement**

`image/pipeline.js`:
```js
import { quantise } from "./quantise.js";
import { matchGlyphs } from "./text.js";
import { edges } from "./field.js";

export const FILTERS = ["none", "edges"];

export function cellSize(method) {
  return method === "text" ? [8, 10] : [2, 3];
}

export function applyFilter(field, filter) {
  if (filter === "none") return field;
  if (filter === "edges") return edges(field);
  throw new Error(`Unknown filter ${filter}`);
}

export function toCells(field, options) {
  return options.method === "text" ? matchGlyphs(field, { palette: options.palette }) : quantise(field, options);
}
```

`prepare.js`: add `cell = [2, 3]` to the options, `width = cols * cell[0]`, `height = rows * cell[1]`. `prepare-browser.js`: same for the target canvas.

`options.js`: `METHODS = ["flat", "diffuse", "bayer", "noise", "dot", "text"]`; import `FILTERS` from `./pipeline.js` would create a cycle (pipeline imports quantise, fine, but options imports presets only; pipeline does not import options), so import is safe; add `filter: choice(raw.filter, "filter", FILTERS, base.filter)` at top level of the returned object.

`presets.js`: add `filter: "none"` to existing presets, change `newsprint` to `{ method: "noise", palette: [0, 7], toneWeight: 0, filter: "none" }`, add `stripes`, `sketch`, `typewriter` as in Interfaces.

`index.js` `convert`:
```js
const options = parseOptions(raw);
const cell = cellSize(options.quantise.method);
const field = applyFilter(await prepare(source, options.cols, options.rows, { position: options.position, levels: options.levels, gamma: options.gamma, cell }), options.filter);
const cells = toCells(field, options.quantise);
```
and re-export `cellSize, applyFilter, toCells`.

`bin/img2vdt.js`: add `.option("--filter <name>", "none or edges (overrides the preset)")` and pass `filter: opts.filter`; update the `--method` and `--preset` help strings.

- [ ] **Step 4: Run** `npm test` → PASS. **Step 5: Commit** `git add image/pipeline.js image/prepare.js image/prepare-browser.js image/options.js image/presets.js image/index.js bin/img2vdt.js test/*.test.js && git commit -m "Add pipeline with text mode, filters and the stripes, sketch and typewriter presets"`.

---

### Task 5: Playground

**Files:** Modify `emulator/playground.html`.

- [ ] **Step 1:** Import `cellSize, applyFilter, toCells` from `/lib/image/pipeline.js` instead of `quantise`. `convertLocal` becomes: `const cell = cellSize(options.quantise.method); const field = applyFilter(prepareCanvas(drawable, options.cols, options.rows, { position, levels, gamma, mirror, cell }), options.filter); const cells = toCells(field, options.quantise);`.
- [ ] **Step 2:** Method select options: `flat, diffuse, bayer, noise, dot, text`. Add a `filter` select (`none`, `edges`) after `tone`. `applyPreset` also sets `fields.filter`; `matchingPreset` compares filter too; `rawOptions` sends it (it is a named form field, so it already does). Descriptions: `newsprint: "blue-noise dither in black and white: newspaper grain"`, `stripes: "ink stripes grow as the tone darkens: black on white"`, `sketch: "edge magnitude in greys, no dither: drawn outline"`, `typewriter: "the Minitel's own characters as grey ink on black"`. Preset select options in the same order as `PRESETS`.
- [ ] **Step 3: Verify headlessly** with the usual probe page: load `screens/omelette-large.png`, cycle through every preset, log the status of each (no errors, byte count present), and screenshot `typewriter` and `sketch`. Confirm `server` ticked gives the same bytes as `node bin/img2vdt.js screens/omelette-large.png --preset typewriter | wc -c`.
- [ ] **Step 4: Commit** `git add emulator/playground.html && git commit -m "Playground: noise, dot and text methods, edges filter, new presets"`.

---

### Task 6: Docs and devlog

- [ ] Update the README preset list and the CLI example flags (`--filter`). Append a spec amendment: methods `noise` and `dot`, the `edges` filter, text mode with the generated glyph table, the preset table with eight rows, and the note that separated mosaics are hardware-supported but parked pending a tube test.
- [ ] `npm test` green, commit `Document the new looks`.
- [ ] Copy this plan to `~/code/meta-repo/3615/image-to-videotex/plan-more-looks.md`, add the exploration sheets and `explore.js` under `probe-looks/`, append the execution log entry, commit only those paths.
