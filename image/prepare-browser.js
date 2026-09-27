// Browser counterpart of prepare.js: canvas does the decode, crop and resample,
// the shared field core does the rest.
import { rgbToField, coverRect } from "./field.js";

const stage = document.createElement("canvas");
const target = document.createElement("canvas");

function sizeOf(source) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  if (!width || !height) throw new Error("Source has no pixels yet");
  return { width, height };
}

export function prepareCanvas(source, cols, rows, { position = "centre", levels = true, gamma = 1, mirror = false } = {}) {
  const src = sizeOf(source);
  const { sx, sy, sw, sh } = coverRect(src.width, src.height, cols * 8, rows * 10, position);
  stage.width = cols * 8;
  stage.height = rows * 10;
  const sctx = stage.getContext("2d");
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.imageSmoothingQuality = "high";
  sctx.fillStyle = "#000";
  sctx.fillRect(0, 0, stage.width, stage.height);
  if (mirror) sctx.setTransform(-1, 0, 0, 1, stage.width, 0);
  sctx.drawImage(source, sx, sy, sw, sh, 0, 0, stage.width, stage.height);

  const width = cols * 2;
  const height = rows * 3;
  target.width = width;
  target.height = height;
  const tctx = target.getContext("2d");
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(stage, 0, 0, width, height);
  const { data } = tctx.getImageData(0, 0, width, height);
  return rgbToField(data, width, height, { levels, gamma });
}
