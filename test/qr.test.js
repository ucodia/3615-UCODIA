import { test } from "node:test";
import assert from "node:assert/strict";
import { qrBitmap } from "../slice/qr.js";

const URL = "https://maps.app.goo.gl/yg9k32N6Fge48N1N7";

test("the maps link renders as a 66 pixel square (version 3, margin 2, scale 2)", () => {
  const bitmap = qrBitmap(URL);
  assert.equal(bitmap.length, 66);
  for (const line of bitmap) assert.equal(line.length, 66);
});

test("the margin is light and the finder pattern corner is dark", () => {
  const bitmap = qrBitmap(URL);
  assert.equal(bitmap[0][0], 0);
  assert.equal(bitmap[3][3], 0);
  assert.equal(bitmap[4][4], 1);
  assert.equal(bitmap[5][5], 1);
});

test("each module is replicated into a scale by scale block", () => {
  const bitmap = qrBitmap(URL);
  assert.equal(bitmap[4][4], 1);
  assert.equal(bitmap[5][4], 1);
  assert.equal(bitmap[4][5], 1);
  assert.equal(bitmap[5][5], 1);
  assert.equal(bitmap[3][4], 0);
  assert.equal(bitmap[4][3], 0);
});

test("scale and margin are configurable", () => {
  const bitmap = qrBitmap(URL, { scale: 1, margin: 0 });
  assert.equal(bitmap.length, 29);
  assert.equal(bitmap[0][0], 1);
});

test("the bitmap fits the 80x72 mosaic pixel screen", () => {
  const bitmap = qrBitmap(URL);
  assert.ok(bitmap.length <= 72);
  assert.ok(bitmap[0].length <= 80);
});
