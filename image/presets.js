import { ALL_COLOURS } from "./levels.js";

const BW = Object.freeze([0, 7]);

export const PRESETS = Object.freeze({
  photo: Object.freeze({ method: "diffuse", palette: ALL_COLOURS, toneWeight: 2, filter: "none" }),
  poster: Object.freeze({ method: "flat", palette: ALL_COLOURS, toneWeight: 0, filter: "none" }),
  halftone: Object.freeze({ method: "bayer", palette: ALL_COLOURS, toneWeight: 0, filter: "none" }),
  newsprint: Object.freeze({ method: "noise", palette: BW, toneWeight: 0, filter: "none" }),
  stencil: Object.freeze({ method: "flat", palette: Object.freeze([0, 4, 7]), toneWeight: 0, filter: "none" }),
  stripes: Object.freeze({ method: "dot", palette: BW, toneWeight: 0, filter: "none" }),
  sketch: Object.freeze({ method: "flat", palette: ALL_COLOURS, toneWeight: 0, filter: "edges" }),
  typewriter: Object.freeze({ method: "text", palette: ALL_COLOURS, toneWeight: 0, filter: "none" }),
  smooth: Object.freeze({ method: "flat", palette: ALL_COLOURS, toneWeight: 0, filter: "median" }),
});

export function preset(name) {
  if (!Object.hasOwn(PRESETS, name)) throw new Error(`Unknown preset ${name}`);
  return PRESETS[name];
}
