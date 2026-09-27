export function stretch(data, lo = 0.01, hi = 0.99) {
  const sorted = Float32Array.from(data).sort();
  const a = sorted[Math.floor(lo * (sorted.length - 1))];
  const b = sorted[Math.floor(hi * (sorted.length - 1))];
  if (b - a < 1e-6) return Float32Array.from(data);
  return data.map((v) => Math.min(1, Math.max(0, (v - a) / (b - a))));
}

// Interleaved 8-bit pixels, 1 (grey), 3 (RGB) or 4 (RGBA) channels, to a lightness field.
export function rgbToField(pixels, width, height, { levels = true, gamma = 1 } = {}) {
  const count = width * height;
  const channels = pixels.length / count;
  if (channels !== 1 && channels !== 3 && channels !== 4) {
    throw new Error(`Expected 1, 3 or 4 channels, got ${channels}`);
  }
  let data = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * channels;
    data[i] = channels === 1
      ? pixels[o] / 255
      : (0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2]) / 255;
  }
  if (levels) data = stretch(data);
  if (gamma !== 1) data = data.map((v) => v ** gamma);
  return { width, height, data };
}

const ANCHORS = {
  centre: [0.5, 0.5],
  top: [0.5, 0],
  bottom: [0.5, 1],
  left: [0, 0.5],
  right: [1, 0.5],
};

// Source rectangle that covers the destination aspect ratio, placed by anchor.
export function coverRect(srcW, srcH, dstW, dstH, position = "centre") {
  const anchor = ANCHORS[position];
  if (!anchor) throw new Error(`Unsupported crop position ${position}`);
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / scale;
  const sh = dstH / scale;
  return { sx: (srcW - sw) * anchor[0], sy: (srcH - sh) * anchor[1], sw, sh };
}
