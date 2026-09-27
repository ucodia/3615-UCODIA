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

test("diffuse reproduces a mean tone that a single cell cannot reach", () => {
  // 0.03 sits between the reachable in-cell mixes 0 and 0.4/6
  const f = field(40, 24, () => 0.03);
  const diffused = quantise(f, { method: "diffuse" });
  const flatCells = quantise(f, { method: "flat" });
  const avg = (cells) => mean(cells.flat().map((c) => mean(renderCell(c))));
  assert.ok(Math.abs(avg(diffused) - 0.03) < 0.01, `diffuse mean ${avg(diffused)}`);
  assert.ok(Math.abs(avg(flatCells) - 0.03) > 0.025, `flat mean ${avg(flatCells)}`);
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

// naive reference: literal per-subpixel squared error plus the tone term
function fitCellReference(target, palette, toneWeight) {
  const targetMean = mean(target);
  let best = { cost: Infinity };
  for (let bits = 0; bits < 64; bits++) {
    for (const fg of palette) {
      for (const bg of palette) {
        if ((bits === 0 || bits === 63) && fg !== bg) continue;
        const got = renderCell({ bits, fg, bg });
        let sse = 0;
        for (let i = 0; i < 6; i++) sse += (target[i] - got[i]) ** 2;
        const tone = mean(got) - targetMean;
        const cost = sse + toneWeight * 6 * tone * tone;
        // same tie-break as fitCell: exact ties go to the first candidate
        if (cost < best.cost - 1e-12) best = { bits, fg, bg, cost };
      }
    }
  }
  return best;
}

test("fitCell matches the naive reference on random blocks", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  for (let n = 0; n < 300; n++) {
    const target = Array.from({ length: 6 }, () => Math.round(rand() * 100) / 100);
    const toneWeight = [0, 1, 2][n % 3];
    const palette = n % 5 === 0 ? [0, 4, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
    const got = fitCell(target, { palette, toneWeight });
    const want = fitCellReference(target, palette, toneWeight);
    assert.ok(Math.abs(got.cost - want.cost) < 1e-9, `cost ${got.cost} vs ${want.cost} for ${target}`);
    assert.deepEqual(renderCell(got), renderCell(want), `render for ${target}`);
  }
});

test("a full screen quantises within budget", () => {
  const f = field(80, 72, (x, y) => ((x * 31 + y * 17) % 101) / 100);
  quantise(f, { method: "flat" });
  const start = performance.now();
  quantise(f, { method: "flat" });
  const ms = performance.now() - start;
  assert.ok(ms < 120, `took ${ms.toFixed(0)} ms`);
});

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
