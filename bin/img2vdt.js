#!/usr/bin/env node
import { program } from "commander";
import { writeFile } from "node:fs/promises";
import { convert } from "../image/index.js";

program
  .name("img2vdt")
  .description("Convert a raster image to a greyscale Minitel videotex stream")
  .argument("<image>", "image file readable by sharp")
  .option("--cols <n>", "cell columns", "40")
  .option("--rows <n>", "cell rows", "24")
  .option("--row <n>", "screen row of the top-left cell", "1")
  .option("--col <n>", "screen column of the top-left cell", "1")
  .option("--preset <name>", "photo, poster, halftone, newsprint, stencil, stripes, sketch or typewriter", "photo")
  .option("--method <name>", "flat, diffuse, bayer, noise, dot or text (overrides the preset)")
  .option("--filter <name>", "none or edges (overrides the preset)")
  .option("--palette <list>", "allowed colour indices, e.g. 0,4,7 (overrides the preset)")
  .option("--tone <weight>", "mean tone weight (overrides the preset)")
  .option("--no-levels", "skip percentile auto levels")
  .option("--gamma <g>", "gamma applied after levels", "1")
  .option("--position <p>", "crop anchor: centre, top, right, bottom, left, entropy, attention", "centre")
  .option("--out <file>", "write the stream to a file instead of stdout")
  .parse();

const opts = program.opts();
try {
  const { bytes } = await convert(program.args[0], {
    cols: opts.cols,
    rows: opts.rows,
    row: opts.row,
    col: opts.col,
    preset: opts.preset,
    method: opts.method,
    palette: opts.palette,
    tone: opts.tone,
    filter: opts.filter,
    levels: opts.levels,
    gamma: opts.gamma,
    position: opts.position,
  });
  if (opts.out) await writeFile(opts.out, bytes);
  else process.stdout.write(bytes);
  console.error(`${bytes.length} bytes, ${(bytes.length / 480).toFixed(1)} s at 4800 baud`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
