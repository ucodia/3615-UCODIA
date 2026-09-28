import { Screen, encode } from "../screen.js";
import { drawBitmap } from "../mosaic.js";

const ROWS = 24;
const COLS = 40;
const BLANC = 7;
const CYAN = 6;
const VERT = 2;

// 16 by 15 pixel smiley: 8 columns by 5 rows of mosaic cells
const SMILEY = [
  ".....######.....",
  "...##......##...",
  "..#..........#..",
  ".#....#..#....#.",
  "#.....#..#.....#",
  "#..............#",
  "#..............#",
  "#..#........#..#",
  "#...#......#...#",
  ".#...######...#.",
  ".#............#.",
  "..#..........#..",
  "...##......##...",
  ".....######.....",
  "................",
].map((line) => [...line].map((ch) => (ch === "#" ? 1 : 0)));

// top-left cell of the sprite for each step; the text sits under it
const PATH = [
  [3, 17],
  [3, 4],
  [13, 29],
  [13, 4],
  [8, 17],
];

export function renderAttract(step) {
  const [row, col] = PATH[step % PATH.length];
  const screen = new Screen(ROWS, COLS);
  drawBitmap(screen, row, col, SMILEY, { fg: BLANC });
  screen.text(row + 5, col - 1, "3615 SLICE", { fg: VERT });
  screen.text(row + 6, col - 3, " press any key ", { fg: CYAN, inverse: true });
  return screen;
}

// Idle countdown against m.lastActivity plus a keep-alive byte; stop() clears both.
export function startIdle(m, { idleMs, keepaliveMs, keepalive = "\x00", onIdle }) {
  let idleTimer = null;
  const arm = (delay) => {
    idleTimer = setTimeout(() => {
      const remaining = idleMs - (Date.now() - m.lastActivity);
      if (remaining > 0) arm(remaining);
      else onIdle();
    }, delay);
  };
  arm(idleMs);
  const beat = keepaliveMs > 0 ? setInterval(() => { m.send(keepalive).catch(() => {}); }, keepaliveMs) : null;
  return {
    stop() {
      clearTimeout(idleTimer);
      if (beat) clearInterval(beat);
    },
  };
}

// Draws the moving invitation until a key arrives; that key is consumed here.
export async function runAttract(m, { frameMs = 5000 } = {}) {
  let step = 0;
  const frame = async () => {
    await m.home();
    await m.cls();
    await m.send(encode(renderAttract(step++)));
  };
  await frame();
  while (true) {
    const woke = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), frameMs);
      m.key().then(() => { clearTimeout(timer); resolve(true); }, () => { clearTimeout(timer); resolve(true); });
    });
    if (woke) return;
    await frame();
  }
}
