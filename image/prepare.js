import sharp from "sharp";
import { rgbToField } from "./field.js";

const MAX_PIXELS = 40_000_000;

export async function prepare(source, cols, rows, { position = "centre", levels = true, gamma = 1, maxPixels = MAX_PIXELS } = {}) {
  const width = cols * 2;
  const height = rows * 3;
  // sharp keeps only the last resize of a pipeline, so crop and resample are two pipelines
  const cropped = await sharp(source, { limitInputPixels: maxPixels })
    .flatten({ background: "#000000" })
    .resize(cols * 8, rows * 10, { fit: "cover", position })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { channels } = cropped.info;
  const raw = await sharp(cropped.data, { raw: { width: cols * 8, height: rows * 10, channels } })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return rgbToField(raw.data, width, height, { levels, gamma });
}
