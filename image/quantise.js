import { LEVELS, ALL_COLOURS, mean, renderCell } from "./levels.js";
import { blueNoise } from "./noise.js";

const DEFAULTS = Object.freeze({
  method: "diffuse",
  palette: ALL_COLOURS,
  toneWeight: 2,
  serpentine: true,
});

// Per pattern, the squared error over the 6 subpixels expands to
// sum(t^2) - 2 fg sum(t_on) + n_on fg^2 - 2 bg sum(t_off) + n_off bg^2,
// so each (fg, bg) pair costs O(1) once the pattern sums are known.
export function fitCell(target, { palette = ALL_COLOURS, toneWeight = 2 } = {}) {
  const targetMean = mean(target);
  let total = 0;
  let squares = 0;
  for (let i = 0; i < 6; i++) {
    total += target[i];
    squares += target[i] * target[i];
  }
  let best = { bits: 0, fg: palette[0], bg: palette[0], cost: Infinity };
  // (bits, fg, bg) renders the same as (~bits, bg, fg), so half the patterns cover every cell
  for (let bits = 0; bits < 32; bits++) {
    let onCount = 0;
    let onSum = 0;
    for (let i = 0; i < 6; i++) {
      if ((bits >> i) & 1) {
        onCount++;
        onSum += target[i];
      }
    }
    const offCount = 6 - onCount;
    const offSum = total - onSum;
    const uniform = bits === 0;
    for (const fg of palette) {
      const f = LEVELS[fg];
      const onPart = onCount * f * f - 2 * f * onSum;
      for (const bg of palette) {
        if (uniform && fg !== bg) continue;
        const b = LEVELS[bg];
        const sse = squares + onPart + offCount * b * b - 2 * b * offSum;
        const tone = (onCount * f + offCount * b) / 6 - targetMean;
        const cost = sse + toneWeight * 6 * tone * tone;
        // ties go to the first candidate in search order; the epsilon hides rounding noise
        if (cost < best.cost - 1e-12) best = { bits, fg, bg, cost };
      }
    }
  }
  return best;
}

export function cellTarget({ width, data }, cx, cy) {
  const out = new Array(6);
  for (let dy = 0; dy < 3; dy++)
    for (let dx = 0; dx < 2; dx++)
      out[dy * 2 + dx] = data[(cy * 3 + dy) * width + cx * 2 + dx];
  return out;
}

function strip({ bits, fg, bg }) {
  return { bits, fg, bg };
}

// Map every cell's six target values through fn.
function grid(field, fn) {
  const cols = field.width / 2;
  const rows = field.height / 3;
  const cells = [];
  for (let cy = 0; cy < rows; cy++) {
    const line = [];
    for (let cx = 0; cx < cols; cx++) line.push(fn(cellTarget(field, cx, cy)));
    cells.push(line);
  }
  return cells;
}

function flat(field, options) {
  return grid(field, (target) => strip(fitCell(target, options)));
}

// Floyd-Steinberg with the neighbourhood in cell units: the residual of
// subpixel (dx, dy) lands on subpixel (dx, dy) of the neighbouring cells.
const SPREAD = [
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16],
  [0, 1, 5 / 16],
  [1, 1, 1 / 16],
];

function diffuse(field, options) {
  const { width, height } = field;
  const cols = width / 2;
  const rows = height / 3;
  const acc = { width, height, data: Float32Array.from(field.data) };
  const cells = Array.from({ length: rows }, () => new Array(cols));
  for (let cy = 0; cy < rows; cy++) {
    const reverse = options.serpentine && cy % 2 === 1;
    for (let k = 0; k < cols; k++) {
      const cx = reverse ? cols - 1 - k : k;
      const target = cellTarget(acc, cx, cy);
      const cell = strip(fitCell(target, options));
      cells[cy][cx] = cell;
      const got = renderCell(cell);
      for (let i = 0; i < 6; i++) {
        const err = target[i] - got[i];
        const dx = i % 2;
        const dy = (i - dx) / 2;
        for (const [ox, oy, weight] of SPREAD) {
          const nx = cx + (reverse ? -ox : ox);
          const ny = cy + oy;
          if (nx < 0 || nx >= cols || ny >= rows) continue;
          acc.data[(ny * 3 + dy) * width + nx * 2 + dx] += err * weight;
        }
      }
    }
  }
  return cells;
}

const BAYER8 = (() => {
  let m = [[0]];
  for (let n = 1; n < 8; n *= 2) {
    const next = [];
    for (let y = 0; y < n * 2; y++) {
      next.push([]);
      for (let x = 0; x < n * 2; x++) {
        const quadrant = (y >= n ? 2 : 0) + (x >= n ? 1 : 0);
        next[y].push(m[y % n][x % n] * 4 + [0, 2, 3, 1][quadrant]);
      }
    }
    m = next;
  }
  return m;
})();

function paletteLevels(palette) {
  return [...new Set(palette.map((i) => LEVELS[i]))].sort((a, b) => a - b);
}

// Ordered dither onto the palette's levels with any threshold function, then a flat fit.
function ordered(field, options, threshold) {
  const { width, height } = field;
  const levels = paletteLevels(options.palette);
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = field.data[y * width + x];
      let lo = levels[0];
      let hi = levels[levels.length - 1];
      for (let i = 0; i < levels.length - 1; i++) {
        if (v >= levels[i] && v <= levels[i + 1]) {
          lo = levels[i];
          hi = levels[i + 1];
          break;
        }
      }
      const position = hi === lo ? 0 : (v - lo) / (hi - lo);
      data[y * width + x] = position > threshold(x, y) ? hi : lo;
    }
  }
  return flat({ width, height, data }, options);
}

const bayer = (field, options) => ordered(field, options, (x, y) => (BAYER8[y % 8][x % 8] + 0.5) / 64);
const noise = (field, options) => ordered(field, options, blueNoise());

const GROWTH = [2, 3, 0, 5, 1, 4];
const DOT_PATTERNS = Array.from({ length: 7 }, (_, k) => GROWTH.slice(0, k).reduce((bits, i) => bits | (1 << i), 0));

// Stripe dots: ink grows in a fixed order as the cell darkens, between the palette's extremes.
function dot(field, options) {
  const byLevel = [...options.palette].sort((a, b) => LEVELS[a] - LEVELS[b]);
  const ink = byLevel[0];
  const paper = byLevel[byLevel.length - 1];
  const range = LEVELS[paper] - LEVELS[ink];
  return grid(field, (target) => {
    if (range === 0) return { bits: 0, fg: ink, bg: ink };
    const k = Math.round(((LEVELS[paper] - mean(target)) / range) * 6);
    return { bits: DOT_PATTERNS[Math.min(6, Math.max(0, k))], fg: ink, bg: paper };
  });
}

const METHODS = { flat, diffuse, bayer, noise, dot };

export function quantise(field, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const method = METHODS[opts.method];
  if (!method) throw new Error(`Unknown method ${opts.method}`);
  return method(field, opts);
}
