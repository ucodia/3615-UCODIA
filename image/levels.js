export const LEVELS = Object.freeze([0, 0.5, 0.7, 0.9, 0.4, 0.6, 0.8, 1]);
export const ALL_COLOURS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]);

export function renderCell({ bits, fg, bg }) {
  const out = new Array(6);
  for (let i = 0; i < 6; i++) out[i] = LEVELS[(bits >> i) & 1 ? fg : bg];
  return out;
}

export function mean(values) {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
