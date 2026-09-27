import { PRESETS } from "./presets.js";

export class OptionError extends Error {}

const METHODS = ["flat", "diffuse", "bayer"];
const POSITIONS = ["centre", "top", "right", "bottom", "left", "entropy", "attention"];

function integer(raw, name, min, max, fallback) {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new OptionError(`${name} must be an integer between ${min} and ${max}`);
  }
  return n;
}

function positive(raw, name, fallback, { allowZero }) {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
    throw new OptionError(`${name} must be a ${allowZero ? "non-negative" : "positive"} number`);
  }
  return n;
}

function boolean(raw, name, fallback) {
  if (raw === undefined || raw === "") return fallback;
  if (raw === true || raw === "true" || raw === "1") return true;
  if (raw === false || raw === "false" || raw === "0") return false;
  throw new OptionError(`${name} must be true or false`);
}

function choice(raw, name, choices, fallback) {
  if (raw === undefined || raw === "") return fallback;
  if (!choices.includes(raw)) throw new OptionError(`${name} must be one of ${choices.join(", ")}`);
  return raw;
}

function palette(raw) {
  const items = Array.isArray(raw) ? raw : String(raw).split(",");
  const out = [];
  for (const item of items) {
    const n = Number(item);
    if (item === "" || !Number.isInteger(n) || n < 0 || n > 7) {
      throw new OptionError("palette must be a comma-separated list of colour indices 0 to 7");
    }
    if (!out.includes(n)) out.push(n);
  }
  if (out.length === 0) throw new OptionError("palette must not be empty");
  return out;
}

export function parseOptions(raw = {}) {
  const presetName = choice(raw.preset, "preset", Object.keys(PRESETS), "photo");
  const base = PRESETS[presetName];
  const quantise = {
    method: choice(raw.method, "method", METHODS, base.method),
    palette: raw.palette === undefined || raw.palette === "" ? [...base.palette] : palette(raw.palette),
    toneWeight: positive(raw.tone, "tone", base.toneWeight, { allowZero: true }),
  };
  return {
    cols: integer(raw.cols, "cols", 1, 40, 40),
    rows: integer(raw.rows, "rows", 1, 24, 24),
    row: integer(raw.row, "row", 1, 24, 1),
    col: integer(raw.col, "col", 1, 40, 1),
    preset: presetName,
    position: choice(raw.position, "position", POSITIONS, "centre"),
    levels: boolean(raw.levels, "levels", true),
    gamma: positive(raw.gamma, "gamma", 1, { allowZero: false }),
    quantise,
  };
}
