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
