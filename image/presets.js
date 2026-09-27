import { ALL_COLOURS } from "./levels.js";

export const PRESETS = Object.freeze({
  photo: Object.freeze({ method: "diffuse", palette: ALL_COLOURS, toneWeight: 2 }),
  poster: Object.freeze({ method: "flat", palette: ALL_COLOURS, toneWeight: 0 }),
  halftone: Object.freeze({ method: "bayer", palette: ALL_COLOURS, toneWeight: 0 }),
  newsprint: Object.freeze({ method: "diffuse", palette: Object.freeze([0, 7]), toneWeight: 2 }),
  stencil: Object.freeze({ method: "flat", palette: Object.freeze([0, 4, 7]), toneWeight: 0 }),
});

export function preset(name) {
  if (!Object.hasOwn(PRESETS, name)) throw new Error(`Unknown preset ${name}`);
  return PRESETS[name];
}
