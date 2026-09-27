import sharp from "sharp";

export function stretch(data, lo = 0.01, hi = 0.99) {
  const sorted = Float32Array.from(data).sort();
  const a = sorted[Math.floor(lo * (sorted.length - 1))];
  const b = sorted[Math.floor(hi * (sorted.length - 1))];
  if (b - a < 1e-6) return Float32Array.from(data);
  return data.map((v) => Math.min(1, Math.max(0, (v - a) / (b - a))));
}

const MAX_PIXELS = 40_000_000;

export async function prepare(source, cols, rows, { position = "centre", levels = true, gamma = 1, maxPixels = MAX_PIXELS } = {}) {
  const width = cols * 2;
  const height = rows * 3;
  // sharp keeps only the last resize of a pipeline, so crop and resample are two pipelines
  const cropped = await sharp(source, { limitInputPixels: maxPixels })
    .flatten({ background: "#000000" })
    .greyscale()
    .resize(cols * 8, rows * 10, { fit: "cover", position })
    .raw()
    .toBuffer();
  const raw = await sharp(cropped, { raw: { width: cols * 8, height: rows * 10, channels: 1 } })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .greyscale()
    .raw()
    .toBuffer();
  let data = Float32Array.from(raw, (v) => v / 255);
  if (levels) data = stretch(data);
  if (gamma !== 1) data = data.map((v) => v ** gamma);
  return { width, height, data };
}
