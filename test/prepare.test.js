import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { prepare } from "../image/prepare.js";

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

test("prepare rejects images over the pixel limit", async () => {
  const src = await png(320, 240, () => 128);
  await assert.rejects(prepare(src, 2, 1, { maxPixels: 1000 }), /pixel limit/i);
  await prepare(src, 2, 1, { maxPixels: 320 * 240 });
});

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

test("prepare samples 8x10 per cell when asked", async () => {
  const src = await png(320, 240, (x) => Math.round((x / 319) * 255));
  const f = await prepare(src, 40, 24, { cell: [8, 10] });
  assert.equal(f.width, 320);
  assert.equal(f.height, 240);
});
