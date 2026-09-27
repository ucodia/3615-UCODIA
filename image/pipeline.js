import { quantise } from "./quantise.js";
import { matchGlyphs } from "./text.js";
import { edges, median } from "./field.js";

export const FILTERS = ["none", "edges", "median"];

export function cellSize(method) {
  return method === "text" ? [8, 10] : [2, 3];
}

export function applyFilter(field, filter) {
  if (filter === "none") return field;
  if (filter === "edges") return edges(field);
  if (filter === "median") return median(field);
  throw new Error(`Unknown filter ${filter}`);
}

export function toCells(field, options) {
  return options.method === "text" ? matchGlyphs(field, { palette: options.palette }) : quantise(field, options);
}
