import { mosaicCode } from "./mosaic.js";

export const DEFAULT_CELL = Object.freeze({
  char: " ",
  fg: 7,
  bg: 0,
  inverse: false,
  flash: false,
  mosaic: false,
});

const ESC = "\x1b";
const REPEAT_MAX = 63;

function validateChar(cell) {
  if (cell.mosaic) {
    if (!Number.isInteger(cell.char) || cell.char < 0 || cell.char > 63) {
      throw new Error(`Mosaic cell expects bits 0-63, got ${JSON.stringify(cell.char)}`);
    }
    return;
  }
  if (typeof cell.char !== "string" || cell.char.length !== 1) {
    throw new Error(`Text cell expects one character, got ${JSON.stringify(cell.char)}`);
  }
  const code = cell.char.charCodeAt(0);
  if (code < 0x20 || code > 0x7e) {
    throw new Error(`Text cell expects ASCII 0x20-0x7E, got ${JSON.stringify(cell.char)}`);
  }
}

function sameCell(a, b) {
  return (
    a.char === b.char &&
    a.fg === b.fg &&
    a.bg === b.bg &&
    a.inverse === b.inverse &&
    a.flash === b.flash &&
    a.mosaic === b.mosaic
  );
}

export class Screen {
  constructor(rows = 24, cols = 40) {
    this.rows = rows;
    this.cols = cols;
    this.cells = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ ...DEFAULT_CELL })),
    );
  }

  #inside(row, col) {
    return row >= 1 && row <= this.rows && col >= 1 && col <= this.cols;
  }

  get(row, col) {
    return this.cells[row - 1][col - 1];
  }

  set(row, col, cell) {
    const merged = { ...DEFAULT_CELL, ...cell };
    validateChar(merged);
    if (!this.#inside(row, col)) return;
    this.cells[row - 1][col - 1] = merged;
  }

  text(row, col, str, attrs = {}) {
    for (let i = 0; i < str.length; i++) {
      this.set(row, col + i, { ...attrs, char: str[i], mosaic: false });
    }
  }

  fill(row1, col1, row2, col2, cell) {
    for (let row = row1; row <= row2; row++) {
      for (let col = col1; col <= col2; col++) {
        this.set(row, col, cell);
      }
    }
  }

  blit(src, srcRow, srcCol, rows, cols, dstRow, dstCol) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!src.#inside(srcRow + r, srcCol + c)) continue;
        this.set(dstRow + r, dstCol + c, src.get(srcRow + r, srcCol + c));
      }
    }
  }
}

function attributeCodes(state, cell) {
  let out = "";
  let inverse = state.inverse;
  if (cell.mosaic !== state.mosaic) {
    out += cell.mosaic ? "\x0e" : "\x0f";
    inverse = false; // the receiver clears inverse on every mode selector
  }
  if (cell.fg !== state.fg) out += ESC + String.fromCharCode(0x40 + cell.fg);
  if (cell.bg !== state.bg) out += ESC + String.fromCharCode(0x50 + cell.bg);
  if (cell.inverse !== inverse) out += ESC + (cell.inverse ? "\x5d" : "\x5c");
  if (cell.flash !== state.flash) out += ESC + (cell.flash ? "\x48" : "\x49");
  return out;
}

function repeatCodes(count) {
  let out = "";
  while (count > 0) {
    const n = Math.min(count, REPEAT_MAX);
    out += "\x12" + String.fromCharCode(0x40 + n);
    count -= n;
  }
  return out;
}

function encodeRow(cells, row) {
  let last = cells.length;
  while (last > 0 && sameCell(cells[last - 1], DEFAULT_CELL)) last--;
  if (last === 0) return "";

  let col = 0;
  while (sameCell(cells[col], DEFAULT_CELL)) col++;
  let out = "\x1f" + String.fromCharCode(0x40 + row) + String.fromCharCode(0x41 + col);
  let state = { ...DEFAULT_CELL, mosaic: null };
  while (col < last) {
    const cell = cells[col];
    const glyph = cell.mosaic
      ? String.fromCharCode(mosaicCode(cell.char))
      : cell.char;
    out += attributeCodes(state, cell) + glyph;
    let run = 1;
    while (col + run < last && sameCell(cells[col + run], cell)) run++;
    if (run >= 3) {
      out += repeatCodes(run - 1);
    } else {
      out += glyph.repeat(run - 1);
    }
    state = cell;
    col += run;
  }
  return out;
}

export function encode(screen) {
  return screen.cells
    .map((cells, index) => encodeRow(cells, index + 1))
    .join("");
}
