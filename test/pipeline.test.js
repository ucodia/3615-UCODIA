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

test("applyFilter median smooths a speck", () => {
  const data = new Float32Array(96).fill(0.5);
  data[3 * 16 + 8] = 1;
  const m = applyFilter({ width: 16, height: 6, data }, "median");
  assert.equal(m.data[3 * 16 + 8], 0.5);
});
