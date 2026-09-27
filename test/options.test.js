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
