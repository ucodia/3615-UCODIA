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
const QR_ROWS = 21; // rows 1 and 2 hold the caption and the url, 3..23 the code, 24 the back hint

export const FILTERS = Object.freeze([
  "poster", "photo", "halftone", "smooth", "newsprint", "stripes", "sketch", "stencil", "typewriter",
]);

// short names for download urls, so a production url fits a version 3 code
export const FILTER_CODES = Object.freeze({
  poster: "poster",
  photo: "photo",
  halftone: "half",
  smooth: "smooth",
  newsprint: "news",
  stripes: "stripe",
  sketch: "sketch",
  stencil: "stencil",
  typewriter: "type",
});

function centred(screen, row, text, attrs = { fg: BLANC }) {
  screen.text(row, Math.floor((COLS - text.length) / 2) + 1, text, attrs);
}

// key labels in inverse cyan followed by their meaning in green, like the other pages
export function renderBar(screen, { captured }) {
  const segments = captured
    ? [[" SPACE ", " capture "], [" F ", " filter "], [" D ", " download"]]
    : [[" SPACE ", " capture "]];
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

// The code sits on a white ground under the caption and the url shown without its scheme,
// with the back hint on the last row; null when the code does not fit between them.
export function renderQr(url, caption) {
  if (url.length > QR_MAX_URL) return null;
  let bitmap = qrBitmap(url, { scale: 2, margin: 1, errorCorrectionLevel: "L" });
  if (Math.ceil(bitmap.length / 3) > QR_ROWS) bitmap = qrBitmap(url, { scale: 2, margin: 0, errorCorrectionLevel: "L" });
  const width = Math.ceil(bitmap[0].length / 2);
  const height = Math.ceil(bitmap.length / 3);
  if (width > COLS || height > QR_ROWS) return null;
  const screen = new Screen(ROWS, COLS);
  screen.fill(1, 1, ROWS, COLS, { mosaic: true, char: 0, fg: NOIR, bg: BLANC });
  drawBitmap(screen, Math.round((QR_ROWS - height) / 2) + 3, Math.floor((COLS - width) / 2) + 1, bitmap, { fg: NOIR, bg: BLANC });
  // inverse video on the default colours: black text on white, no serial background attribute needed
  const line = (row, text) => screen.text(row, 1, (" ".repeat(Math.floor((COLS - text.length) / 2)) + text).slice(0, COLS).padEnd(COLS), { inverse: true });
  line(1, caption);
  line(2, url.replace(/^https?:\/\//, ""));
  line(ROWS, "press any key to go back");
  return screen;
}

export function renderUrl(url) {
  const screen = new Screen(ROWS, COLS);
  centred(screen, 10, "open this address to download:");
  for (let i = 0; i * COLS < url.length; i++) screen.text(12 + i, 1, url.slice(i * COLS, (i + 1) * COLS), { fg: BLANC });
  return screen;
}
