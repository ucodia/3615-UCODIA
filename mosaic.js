export function mosaicCode(bits) {
  return 0x20 + (bits & 0x1f) + (bits & 0x20 ? 0x40 : 0);
}

export function drawBitmap(screen, row, col, bitmap, attrs = {}) {
  const height = bitmap.length;
  const width = Math.max(...bitmap.map((line) => line.length));
  const pixel = (y, x) => (y < height && x < width && bitmap[y][x] ? 1 : 0);

  for (let cy = 0; cy < Math.ceil(height / 3); cy++) {
    for (let cx = 0; cx < Math.ceil(width / 2); cx++) {
      let bits = 0;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          bits |= pixel(cy * 3 + dy, cx * 2 + dx) << (dy * 2 + dx);
        }
      }
      screen.set(row + cy, col + cx, { ...attrs, mosaic: true, char: bits });
    }
  }
}
