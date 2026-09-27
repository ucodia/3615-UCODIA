import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { convert } from "../image/index.js";

async function gradient() {
  const buf = Buffer.alloc(320 * 240);
  for (let y = 0; y < 240; y++) for (let x = 0; x < 320; x++) buf[y * 320 + x] = Math.round((x / 319) * 255);
  return sharp(buf, { raw: { width: 320, height: 240, channels: 1 } }).png().toBuffer();
}

test("convert returns cells, field and a videotex buffer for the region", async () => {
  const { cells, field, bytes, options } = await convert(await gradient(), { cols: "10", rows: "4", row: 2, col: 3 });
  assert.equal(cells.length, 4);
  assert.equal(cells[0].length, 10);
  assert.equal(field.width, 20);
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(options.preset, "photo");
  // first row positions at row 2 col 3: 0x1f, 0x40+2, 0x40+3
  assert.deepEqual([...bytes.subarray(0, 3)], [0x1f, 0x42, 0x43]);
  // rows 1 and 6+ are untouched so nothing is emitted for them
  assert.equal(bytes.indexOf(Buffer.from([0x1f, 0x41])), -1);
});

test("every preset converts", async () => {
  const src = await gradient();
  for (const preset of ["photo", "poster", "halftone", "newsprint", "stencil"]) {
    const { bytes } = await convert(src, { preset, cols: 4, rows: 2 });
    assert.ok(bytes.length > 0, preset);
  }
});

test("convert rejects a non-image buffer", async () => {
  await assert.rejects(convert(Buffer.from("not an image"), { cols: 2, rows: 1 }));
});
