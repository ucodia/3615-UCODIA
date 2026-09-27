import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LEVELS } from "./levels.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let sprites = null;

async function sheet(name) {
  const { data, info } = await sharp(join(root, "emulator/font", `${name}.png`)).raw().toBuffer({ resolveWithObject: true });
  const glyphs = [];
  for (let ord = 0; ord < 128; ord++) {
    const x0 = Math.floor(ord / 16) * 8;
    const y0 = (ord % 16) * 10;
    const bits = new Uint8Array(80);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 8; x++) {
        const o = ((y0 + y) * info.width + x0 + x) * info.channels;
        const opaque = info.channels < 4 || data[o + 3] > 0;
        bits[y * 8 + x] = opaque && data[o] > 127 ? 1 : 0;
      }
    }
    glyphs.push(bits);
  }
  return glyphs;
}

export async function loadSprites() {
  if (!sprites) sprites = { text: await sheet("ef9345-g0"), mosaic: await sheet("ef9345-g1") };
  return sprites;
}

// Cells to a greyscale PNG using the emulator's own glyph shapes.
export async function renderPng(cells, { scale = 4 } = {}) {
  const { text, mosaic } = await loadSprites();
  const rows = cells.length;
  const cols = cells[0].length;
  const width = cols * 8 * scale;
  const height = rows * 10 * scale;
  const buf = Buffer.alloc(width * height);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const cell = cells[cy][cx];
      const glyph = "char" in cell ? text[cell.char.charCodeAt(0)] : mosaic[0x40 + cell.bits];
      const fg = Math.round(LEVELS[cell.fg] * 255);
      const bg = Math.round(LEVELS[cell.bg] * 255);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 8; x++) {
          const v = glyph[y * 8 + x] ? fg : bg;
          for (let sy = 0; sy < scale; sy++) {
            const row = (cy * 10 + y) * scale + sy;
            buf.fill(v, row * width + (cx * 8 + x) * scale, row * width + (cx * 8 + x + 1) * scale);
          }
        }
      }
    }
  }
  return sharp(buf, { raw: { width, height, channels: 1 } }).png().toBuffer();
}
