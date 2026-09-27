import { GLYPHS } from "./glyphs.js";
import { LEVELS, ALL_COLOURS } from "./levels.js";

// In character-code order so ties resolve the same way everywhere.
const ENTRIES = Array.from({ length: 95 }, (_, i) => String.fromCharCode(0x20 + i)).map((char) => {
  const on = [];
  GLYPHS[char].forEach((row, y) => {
    for (let x = 0; x < 8; x++) if (row & (0x80 >> x)) on.push(y * 8 + x);
  });
  return { char, on };
});

// Match each 8x10 block against every glyph with grey ink on black, by squared error.
export function matchGlyphs(field, { palette = ALL_COLOURS } = {}) {
  const inks = palette.filter((i) => LEVELS[i] > 0);
  if (inks.length === 0) inks.push(7);
  const cols = field.width / 8;
  const rows = field.height / 10;
  const block = new Float32Array(80);
  const cells = [];
  for (let cy = 0; cy < rows; cy++) {
    const line = [];
    for (let cx = 0; cx < cols; cx++) {
      let squares = 0;
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 8; x++) {
          const v = field.data[(cy * 10 + y) * field.width + cx * 8 + x];
          block[y * 8 + x] = v;
          squares += v * v;
        }
      }
      let best = { cost: Infinity, char: " ", fg: inks[0] };
      for (const { char, on } of ENTRIES) {
        let onSum = 0;
        for (const i of on) onSum += block[i];
        for (const fg of inks) {
          const f = LEVELS[fg];
          const cost = squares - 2 * f * onSum + on.length * f * f;
          if (cost < best.cost - 1e-12) best = { cost, char, fg };
        }
      }
      line.push({ char: best.char, fg: best.fg, bg: 0 });
    }
    cells.push(line);
  }
  return cells;
}
