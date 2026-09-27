import { Screen } from "../screen.js";
import { drawBitmap } from "../mosaic.js";
import { paint } from "../image/paint.js";
import { qrBitmap } from "./qr.js";

const NOIR = 0;
const VERT = 2;
const CYAN = 6;
const BLANC = 7;
const ROWS = 24;
const COLS = 40;
const BAR_ROW = 24;
const QR_MAX_URL = 78; // version 4 at level L

export const FILTERS = Object.freeze([
  "poster", "photo", "halftone", "smooth", "newsprint", "stripes", "sketch", "stencil", "typewriter",
]);

function centred(screen, row, text, attrs = { fg: BLANC }) {
  screen.text(row, Math.floor((COLS - text.length) / 2) + 1, text, attrs);
}

// key labels in inverse cyan followed by their meaning in green, like the other pages
export function renderBar(screen, { captured }) {
  const segments = captured
    ? [[" SPACE ", " capture "], [" F ", " filter "], [" D ", " download"]]
    : [[" SPACE ", " capture  "], [" SOMMAIRE ", " menu"]];
  screen.fill(BAR_ROW, 1, BAR_ROW, COLS, { char: " " });
  let col = 1;
  for (const [key, meaning] of segments) {
    screen.text(BAR_ROW, col, key, { fg: CYAN, inverse: true });
    col += key.length;
    screen.text(BAR_ROW, col, meaning, { fg: VERT });
    col += meaning.length;
  }
  return screen;
}

export function renderIdle() {
  const screen = new Screen(ROWS, COLS);
  centred(screen, 12, "press space to capture");
  return renderBar(screen, { captured: false });
}

export function renderSmile() {
  const screen = new Screen(ROWS, COLS);
  centred(screen, 12, "smile!");
  return screen;
}

const DIGITS = {
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
};
const DIGIT_SCALE = 4;

export function renderCountdown(digit) {
  const screen = new Screen(ROWS, COLS);
  const rows = DIGITS[digit];
  const bitmap = [];
  for (const line of rows) {
    const pixels = [...line].flatMap((ch) => Array(DIGIT_SCALE).fill(ch === "#" ? 1 : 0));
    for (let i = 0; i < DIGIT_SCALE; i++) bitmap.push(pixels);
  }
  const width = Math.ceil(bitmap[0].length / 2);
  const height = Math.ceil(bitmap.length / 3);
  drawBitmap(screen, Math.floor((ROWS - height) / 2) + 1, Math.floor((COLS - width) / 2) + 1, bitmap, { fg: BLANC, bg: NOIR });
  return screen;
}

export function renderPicture(cells) {
  const screen = new Screen(ROWS, COLS);
  paint(screen, 1, 1, cells);
  return renderBar(screen, { captured: true });
}

// The code fills the screen on a white ground; null when the URL needs more than version 4.
export function renderQr(url) {
  if (url.length > QR_MAX_URL) return null;
  const bitmap = qrBitmap(url, { scale: 2, margin: 1, errorCorrectionLevel: "L" });
  const width = Math.ceil(bitmap[0].length / 2);
  const height = Math.ceil(bitmap.length / 3);
  if (width > COLS || height > ROWS) return null;
  const screen = new Screen(ROWS, COLS);
  screen.fill(1, 1, ROWS, COLS, { mosaic: true, char: 0, fg: NOIR, bg: BLANC });
  drawBitmap(screen, Math.floor((ROWS - height) / 2) + 1, Math.floor((COLS - width) / 2) + 1, bitmap, { fg: NOIR, bg: BLANC });
  return screen;
}

export function renderUrl(url) {
  const screen = new Screen(ROWS, COLS);
  centred(screen, 10, "open this address to download:");
  for (let i = 0; i * COLS < url.length; i++) screen.text(12 + i, 1, url.slice(i * COLS, (i + 1) * COLS), { fg: BLANC });
  return screen;
}
