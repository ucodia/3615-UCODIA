import { test } from "node:test";
import assert from "node:assert/strict";
import { blueNoise, SIZE } from "../image/noise.js";

test("blue noise thresholds are a permutation of the 4096 levels", () => {
  const t = blueNoise();
  const values = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) values.push(t(x, y));
  values.sort((a, b) => a - b);
  for (let i = 0; i < values.length; i++) assert.ok(Math.abs(values[i] - (i + 0.5) / (SIZE * SIZE)) < 1e-6, `rank ${i}`);
});

test("blue noise is evenly spread: every 8x8 tile is about half below 0.5", () => {
  const t = blueNoise();
  for (let ty = 0; ty < SIZE; ty += 8) for (let tx = 0; tx < SIZE; tx += 8) {
    let dark = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (t(tx + x, ty + y) < 0.5) dark++;
    assert.ok(dark >= 24 && dark <= 40, `tile ${tx},${ty} has ${dark}`);
  }
});

test("blue noise tiles and is cached", () => {
  const t = blueNoise();
  assert.equal(t(3, 5), t(3 + SIZE, 5 + SIZE));
  assert.equal(blueNoise(), t);
});
