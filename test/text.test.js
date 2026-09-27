import { test } from "node:test";
import assert from "node:assert/strict";
import { matchGlyphs } from "../image/text.js";
import { GLYPHS } from "../image/glyphs.js";

function fieldFromGlyphs(chars, level) {
  const width = chars.length * 8, height = 10;
  const data = new Float32Array(width * height);
  chars.forEach((ch, c) => GLYPHS[ch].forEach((row, y) => { for (let x = 0; x < 8; x++) if (row & (0x80 >> x)) data[y * width + c * 8 + x] = level; }));
  return { width, height, data };
}

test("matchGlyphs recovers exact glyphs and their grey", () => {
  const cells = matchGlyphs(fieldFromGlyphs(["A", "#", " "], 0.7));
  assert.deepEqual(cells[0].map((c) => c.char), ["A", "#", " "]);
  assert.equal(cells[0][0].fg, 2);
  assert.equal(cells[0][0].bg, 0);
});

test("matchGlyphs ignores black as ink", () => {
  const cells = matchGlyphs(fieldFromGlyphs(["A"], 1), { palette: [0] });
  assert.equal(cells[0][0].char, "A");
  assert.equal(cells[0][0].fg, 7);
});

test("matchGlyphs restricts ink to the palette", () => {
  const cells = matchGlyphs(fieldFromGlyphs(["A"], 0.7), { palette: [0, 4, 7] });
  assert.ok([4, 7].includes(cells[0][0].fg));
});
