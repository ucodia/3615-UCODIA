import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { renderPng } from "../image/render.js";

async function pixels(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

test("renderPng sizes the image by cells and scale", async () => {
  const png = await renderPng([[{ bits: 0, fg: 0, bg: 0 }, { bits: 0, fg: 0, bg: 0 }]], { scale: 2 });
  const p = await pixels(png);
  assert.equal(p.width, 32);
  assert.equal(p.height, 20);
});

test("renderPng draws a mosaic subpixel with the foreground grey", async () => {
  const png = await renderPng([[{ bits: 1, fg: 7, bg: 4 }]], { scale: 1 });
  const p = await pixels(png);
  const at = (x, y) => p.data[(y * p.width + x) * p.channels];
  assert.equal(at(0, 0), 255);
  assert.equal(at(3, 2), 255);
  assert.equal(at(4, 0), 102); // 0.4 * 255
  assert.equal(at(0, 3), 102);
});

test("renderPng draws text glyphs from the G0 sheet", async () => {
  const png = await renderPng([[{ char: "A", fg: 7, bg: 0 }]], { scale: 1 });
  const p = await pixels(png);
  const at = (x, y) => p.data[(y * p.width + x) * p.channels];
  assert.equal(at(2, 1), 255);
  assert.equal(at(3, 1), 255);
  assert.equal(at(0, 1), 0);
  assert.equal(at(1, 2), 255);
});
