import { Screen, encode } from "../screen.js";
import { prepare } from "./prepare.js";
import { quantise } from "./quantise.js";
import { paint } from "./paint.js";
import { parseOptions } from "./options.js";
import { cellSize, applyFilter, toCells } from "./pipeline.js";

export { prepare, quantise, paint, parseOptions, cellSize, applyFilter, toCells };
export { OptionError } from "./options.js";
export { PRESETS, preset } from "./presets.js";

export async function convert(source, raw = {}) {
  const options = parseOptions(raw);
  const prepared = await prepare(source, options.cols, options.rows, {
    position: options.position,
    levels: options.levels,
    gamma: options.gamma,
    cell: cellSize(options.quantise.method),
  });
  const field = applyFilter(prepared, options.filter);
  const cells = toCells(field, options.quantise);
  const screen = new Screen(24, 40);
  paint(screen, options.row, options.col, cells);
  const bytes = Buffer.from(encode(screen), "latin1");
  return { cells, field, bytes, options };
}
