import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { indexedPng } from "../image/png.js";

const PALETTE = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]];

test("indexedPng writes a 4-bit palette image that decodes exactly, odd widths included", async () => {
  const width = 5, height = 2;
  const indices = Uint8Array.from([0, 1, 2, 3, 4, 4, 3, 2, 1, 0]);
  const png = indexedPng(indices, width, height, PALETTE);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, width);
  assert.equal(meta.height, height);
  assert.equal(meta.paletteBitDepth, 4);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = PALETTE[indices[i]];
    assert.deepEqual([data[i * info.channels], data[i * info.channels + 1], data[i * info.channels + 2]], [r, g, b], `pixel ${i}`);
  }
});

test("indexedPng rejects palettes over 16 entries and out-of-range indices", () => {
  assert.throws(() => indexedPng(new Uint8Array(1), 1, 1, Array(17).fill([0, 0, 0])), /16/);
  assert.throws(() => indexedPng(Uint8Array.from([7]), 1, 1, PALETTE), /index/);
});
