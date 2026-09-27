import { test } from "node:test";
import assert from "node:assert/strict";
import { GLYPHS } from "../image/glyphs.js";

test("glyph table covers the 95 printable ASCII characters", () => {
  const chars = Object.keys(GLYPHS);
  assert.equal(chars.length, 95);
  for (let code = 0x20; code <= 0x7e; code++) assert.ok(String.fromCharCode(code) in GLYPHS, `missing ${code.toString(16)}`);
  for (const rows of Object.values(GLYPHS)) {
    assert.equal(rows.length, 10);
    for (const row of rows) assert.ok(Number.isInteger(row) && row >= 0 && row <= 255);
  }
});

test("A matches the emulator font, bit 7 is the leftmost pixel", () => {
  assert.deepEqual(GLYPHS["A"], [0x00, 0x38, 0x44, 0x44, 0x44, 0x7c, 0x44, 0x44, 0x00, 0x00]);
  assert.deepEqual(GLYPHS[" "], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});
