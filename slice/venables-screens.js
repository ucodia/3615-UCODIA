import { Screen } from "../screen.js";
import { drawBitmap } from "../mosaic.js";
import { pages, CANVAS_ROWS, PAGE_COLS, SLICE_NAME } from "./venables-data.js";

const NOIR = 0;
const VERT = 2;
const JAUNE = 3;
const BLANC = 7;

const SCREEN_ROWS = 24;
const SCREEN_COLS = 40;

const MAP_TOP = 3;
const STREET_ROWS = [5, 6, 7];
const NORTH_ROWS = { 0: 4, 1: 2, 2: 1 };
const SOUTH_ROWS = { 0: 8, 1: 10, 2: 11 };
const CROSS_BAND_ROWS = {
  both: [1, CANVAS_ROWS],
  N: [1, STREET_ROWS[2]],
  S: [STREET_ROWS[0], CANVAS_ROWS],
};

const LEGEND_TOP = 15;
const LEGEND_COL = 1;
const LEGEND_NAME_COL = LEGEND_COL + 3;
const QR_TOP = 2;
const QR_BOTTOM = 23;
const QR_LEFT = 4;
const QR_MAX_WIDTH = (SCREEN_COLS - QR_LEFT + 1) * 2;
const QR_MAX_HEIGHT = (QR_BOTTOM - QR_TOP + 1) * 3;

export function numberedBusinesses(source = pages) {
  let number = 0;
  return source.flatMap((page, index) =>
    [...page.businesses]
      .sort((a, b) => a.col - b.col || a.side.localeCompare(b.side))
      .map((b) => ({ ...b, page: index, number: ++number })),
  );
}

export function pageCount() {
  return pages.length;
}

export function homePage() {
  return numberedBusinesses().find((b) => b.name === SLICE_NAME).page;
}

export function businessesOnPage(page, source = pages) {
  return numberedBusinesses(source).filter((b) => b.page === page);
}

export function pinStyle(business) {
  return { fg: BLANC, inverse: true, flash: business.name === SLICE_NAME };
}

function pinLabel(business) {
  return String(business.number).padStart(2, "0");
}

function drawStreets(canvas, page) {
  for (const row of STREET_ROWS) {
    canvas.fill(row, 1, row, PAGE_COLS, { bg: JAUNE });
  }
  for (const street of page.streets) {
    const [top, bottom] = CROSS_BAND_ROWS[street.side];
    canvas.fill(top, street.col, bottom, street.col + 2, { bg: JAUNE });
  }
  canvas.text(STREET_ROWS[1], page.labelCol, "VENABLES ST", { fg: NOIR, bg: JAUNE });
  for (const street of page.streets) {
    if (street.label === false) continue;
    const [top, bottom] = CROSS_BAND_ROWS[street.side];
    const start = top + Math.floor((bottom - top + 1 - street.name.length) / 2);
    for (let i = 0; i < street.name.length; i++) {
      canvas.text(start + i, street.col + 1, street.name[i], { fg: NOIR, bg: JAUNE });
    }
  }
}

function drawPins(canvas, page, source) {
  for (const b of businessesOnPage(page, source)) {
    const north = b.side === "N";
    const row = north ? NORTH_ROWS[b.tier] : SOUTH_ROWS[b.tier];
    canvas.text(row, b.col, pinLabel(b), pinStyle(b));
  }
}

function buildCanvas(page, source) {
  const canvas = new Screen(CANVAS_ROWS, PAGE_COLS);
  drawStreets(canvas, source[page]);
  drawPins(canvas, page, source);
  return canvas;
}

const MARQUEE_GAP = "   ";

export function marqueeWindow(note, room, offset) {
  const loop = note + MARQUEE_GAP;
  return Array.from({ length: room }, (_, i) => loop[(offset + i) % loop.length]).join("");
}

function legendSlots(page, source) {
  return businessesOnPage(page, source).map((b, i) => {
    const noteCol = LEGEND_NAME_COL + b.name.length + 1;
    return { business: b, row: LEGEND_TOP + i, noteCol, room: SCREEN_COLS - noteCol + 1 };
  });
}

function drawLegend(screen, page, source) {
  for (const { business: b, row, noteCol, room } of legendSlots(page, source)) {
    screen.text(row, LEGEND_COL, pinLabel(b), pinStyle(b));
    screen.text(row, LEGEND_NAME_COL, b.name, { fg: b.name === SLICE_NAME ? JAUNE : BLANC });
    if (b.note && room > 0) {
      screen.text(row, noteCol, b.note.slice(0, room), { fg: VERT });
    }
  }
}

export function renderLegendNotes(page, offset, source = pages) {
  const screen = new Screen(SCREEN_ROWS, SCREEN_COLS);
  for (const { business: b, row, noteCol, room } of legendSlots(page, source)) {
    if (b.note.length > room && room > 0) {
      screen.text(row, noteCol, marqueeWindow(b.note, room, offset), { fg: VERT });
    }
  }
  return screen;
}

export function renderMapPage(page, source = pages) {
  const screen = new Screen(SCREEN_ROWS, SCREEN_COLS);
  screen.text(1, 2, "VENABLES VIBES", { fg: JAUNE });
  screen.text(1, 37, `${page + 1}/${pageCount()}`, { fg: BLANC });
  screen.fill(2, 1, 2, SCREEN_COLS, { mosaic: true, char: 12, fg: JAUNE });
  screen.blit(buildCanvas(page, source), 1, 1, CANVAS_ROWS, PAGE_COLS, MAP_TOP, 1);
  drawLegend(screen, page, source);
  return screen;
}

export function renderQrPage(bitmap) {
  const height = bitmap.length;
  const width = bitmap[0].length;
  if (height > QR_MAX_HEIGHT || width > QR_MAX_WIDTH) {
    throw new Error(`QR bitmap ${width}x${height} does not fit the screen`);
  }
  const screen = new Screen(SCREEN_ROWS, SCREEN_COLS);
  screen.text(1, 7, "SCAN TO OPEN IN GOOGLE MAPS", { fg: JAUNE });
  screen.fill(QR_TOP, 1, QR_BOTTOM, SCREEN_COLS, {
    mosaic: true,
    char: 0,
    fg: NOIR,
    bg: BLANC,
  });
  drawBitmap(screen, QR_TOP, QR_LEFT, bitmap, { fg: NOIR, bg: BLANC });
  return screen;
}
