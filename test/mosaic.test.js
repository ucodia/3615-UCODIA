import { test } from "node:test";
import assert from "node:assert/strict";
import { Screen, DEFAULT_CELL } from "../screen.js";
import { mosaicCode, drawBitmap } from "../mosaic.js";

test("mosaicCode maps the 64 patterns to the two videotex ranges", () => {
  assert.equal(mosaicCode(0), 0x20);
  assert.equal(mosaicCode(1), 0x21);
  assert.equal(mosaicCode(31), 0x3f);
  assert.equal(mosaicCode(32), 0x60);
  assert.equal(mosaicCode(63), 0x7f);
});

test("drawBitmap packs 2x3 pixel blocks into mosaic bits", () => {
  const s = new Screen(2, 2);
  drawBitmap(
    s,
    1,
    1,
    [
      [1, 0, 0, 0],
      [0, 0, 0, 1],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
    ],
    { fg: 0, bg: 7 },
  );
  assert.deepEqual(s.get(1, 1), { ...DEFAULT_CELL, mosaic: true, char: 1, fg: 0, bg: 7 });
  assert.deepEqual(s.get(1, 2), { ...DEFAULT_CELL, mosaic: true, char: 8, fg: 0, bg: 7 });
  assert.deepEqual(s.get(2, 1), { ...DEFAULT_CELL, mosaic: true, char: 3, fg: 0, bg: 7 });
  assert.deepEqual(s.get(2, 2), { ...DEFAULT_CELL, mosaic: true, char: 3, fg: 0, bg: 7 });
});

test("drawBitmap treats pixels past the bitmap edge as background", () => {
  const s = new Screen(1, 1);
  drawBitmap(s, 1, 1, [[1]]);
  assert.equal(s.get(1, 1).char, 1);
  assert.equal(s.get(1, 1).mosaic, true);
});

test("drawBitmap accepts typed array rows", () => {
  const s = new Screen(1, 1);
  drawBitmap(s, 1, 1, [Uint8Array.from([1, 1]), Uint8Array.from([1, 1]), Uint8Array.from([1, 1])]);
  assert.equal(s.get(1, 1).char, 63);
});
