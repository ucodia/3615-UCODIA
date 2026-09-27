import { test } from "node:test";
import assert from "node:assert/strict";
import { Screen, encode, DEFAULT_CELL } from "../screen.js";
import { paint } from "../image/paint.js";

const cells = [
  [{ bits: 1, fg: 7, bg: 0 }, { bits: 63, fg: 4, bg: 4 }],
  [{ bits: 0, fg: 2, bg: 2 }, { bits: 42, fg: 3, bg: 1 }],
];

test("paint writes mosaic cells at the requested origin", () => {
  const s = new Screen(24, 40);
  paint(s, 5, 10, cells);
  assert.deepEqual(s.get(5, 10), { ...DEFAULT_CELL, mosaic: true, char: 1, fg: 7, bg: 0 });
  assert.deepEqual(s.get(6, 11), { ...DEFAULT_CELL, mosaic: true, char: 42, fg: 3, bg: 1 });
  assert.deepEqual(s.get(5, 9), DEFAULT_CELL);
  assert.deepEqual(s.get(7, 10), DEFAULT_CELL);
});

test("paint clips outside the screen", () => {
  const s = new Screen(24, 40);
  paint(s, 24, 40, cells);
  assert.deepEqual(s.get(24, 40), { ...DEFAULT_CELL, mosaic: true, char: 1, fg: 7, bg: 0 });
});

test("painted cells encode to valid mosaic glyphs only", () => {
  const s = new Screen(2, 2);
  paint(s, 1, 1, cells);
  const out = encode(s);
  // skip position (0x1f + 2), attribute (0x1b + 1) and repeat (0x12 + 1) sequences
  const bytes = [...out].map((c) => c.charCodeAt(0));
  const payload = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x1b || bytes[i] === 0x1f || bytes[i] === 0x12) { i += bytes[i] === 0x1f ? 2 : 1; continue; }
    if (bytes[i] >= 0x20) payload.push(bytes[i]);
  }
  assert.ok(payload.length > 0);
  for (const g of payload) assert.ok((g >= 0x20 && g <= 0x3f) || (g >= 0x60 && g <= 0x7f), `glyph ${g.toString(16)}`);
});
