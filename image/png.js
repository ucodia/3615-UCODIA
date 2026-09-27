import { deflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// A 4-bit indexed PNG: `indices` holds one palette index per pixel, row major;
// `palette` is up to 16 [r, g, b] entries. Lossless and tiny for few-colour images.
export function indexedPng(indices, width, height, palette) {
  if (palette.length > 16) throw new Error("indexedPng takes at most 16 palette entries");
  if (indices.length !== width * height) throw new Error("indexedPng: indices do not match width and height");
  for (const v of indices) if (v >= palette.length) throw new Error(`indexedPng: index ${v} outside the palette`);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 4; // bit depth
  header[9] = 3; // colour type: indexed
  const plte = Buffer.from(palette.flat());
  const stride = Math.ceil(width / 2);
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    for (let x = 0; x < width; x++) {
      const v = indices[y * width + x];
      rows[row + 1 + (x >> 1)] |= x & 1 ? v : v << 4;
    }
  }
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("PLTE", plte),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
