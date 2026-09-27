import { test } from "node:test";
import assert from "node:assert/strict";
import { stretch, rgbToField, coverRect } from "../image/field.js";

test("stretch maps the 1st and 99th percentiles to 0 and 1", () => {
  const data = Float32Array.from({ length: 1000 }, (_, i) => 0.25 + (i / 999) * 0.5);
  const out = stretch(data);
  assert.equal(out[0], 0);
  assert.equal(out[999], 1);
  assert.ok(Math.abs(out[500] - 0.5) < 0.02);
});

test("stretch leaves a flat field unchanged", () => {
  const out = stretch(Float32Array.from({ length: 100 }, () => 0.5));
  for (const v of out) assert.equal(v, 0.5);
});

test("rgbToField uses Rec. 601 luminance and ignores alpha", () => {
  const rgb = Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
  const f = rgbToField(rgb, 4, 1, { levels: false });
  assert.ok(Math.abs(f.data[0] - 0.299) < 1e-3);
  assert.ok(Math.abs(f.data[1] - 0.587) < 1e-3);
  assert.ok(Math.abs(f.data[2] - 0.114) < 1e-3);
  assert.equal(f.data[3], 1);
  const rgba = Uint8Array.from([255, 0, 0, 0, 0, 255, 0, 128]);
  const g = rgbToField(rgba, 2, 1, { levels: false });
  assert.ok(Math.abs(g.data[0] - 0.299) < 1e-3);
  assert.ok(Math.abs(g.data[1] - 0.587) < 1e-3);
});

test("rgbToField passes a single channel through", () => {
  const f = rgbToField(Uint8Array.from([0, 128, 255]), 3, 1, { levels: false });
  assert.deepEqual([...f.data].map((v) => Math.round(v * 255)), [0, 128, 255]);
  assert.equal(f.width, 3);
  assert.equal(f.height, 1);
});

test("rgbToField rejects other channel counts", () => {
  assert.throws(() => rgbToField(new Uint8Array(4), 2, 1), /channels/);
});

test("rgbToField applies levels then gamma", () => {
  const grey = Uint8Array.from({ length: 200 }, (_, i) => 64 + Math.round((i / 199) * 128));
  const levelled = rgbToField(grey, 200, 1);
  assert.equal(levelled.data[0], 0);
  assert.equal(levelled.data[199], 1);
  const dark = rgbToField(Uint8Array.from([128]), 1, 1, { levels: false, gamma: 2 });
  assert.ok(Math.abs(dark.data[0] - (128 / 255) ** 2) < 1e-6);
});

test("coverRect crops a wide source horizontally by anchor", () => {
  assert.deepEqual(coverRect(480, 270, 320, 240, "centre"), { sx: 60, sy: 0, sw: 360, sh: 270 });
  assert.deepEqual(coverRect(480, 270, 320, 240, "left"), { sx: 0, sy: 0, sw: 360, sh: 270 });
  assert.deepEqual(coverRect(480, 270, 320, 240, "right"), { sx: 120, sy: 0, sw: 360, sh: 270 });
  assert.deepEqual(coverRect(480, 270, 320, 240, "top"), { sx: 60, sy: 0, sw: 360, sh: 270 });
});

test("coverRect crops a tall source vertically by anchor", () => {
  assert.deepEqual(coverRect(300, 600, 320, 240, "centre"), { sx: 0, sy: 187.5, sw: 300, sh: 225 });
  assert.deepEqual(coverRect(300, 600, 320, 240, "top"), { sx: 0, sy: 0, sw: 300, sh: 225 });
  assert.deepEqual(coverRect(300, 600, 320, 240, "bottom"), { sx: 0, sy: 375, sw: 300, sh: 225 });
});

test("coverRect rejects anchors the canvas path cannot do", () => {
  assert.throws(() => coverRect(100, 100, 320, 240, "attention"), /position/);
});
