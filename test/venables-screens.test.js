import { test } from "node:test";
import assert from "node:assert/strict";
import {
  numberedBusinesses,
  pageCount,
  businessesOnPage,
  renderMapPage,
  renderQrPage,
  homePage,
  marqueeWindow,
  renderLegendNotes,
} from "../slice/venables-screens.js";
import { DEFAULT_CELL } from "../screen.js";
import { pages, SLICE_NAME, MAP_URL } from "../slice/venables-data.js";

const businesses = pages.flatMap((p) => p.businesses);

const LONG_NOTE = "A note far too long to fit beside this name on one row";
const overflowing = pages.map((p, i) =>
  i === 0
    ? { ...p, businesses: p.businesses.map((b) => (b.name === "The Front Supply Co" ? { ...b, note: LONG_NOTE } : b)) }
    : p,
);
import { encode } from "../screen.js";
import { qrBitmap } from "../slice/qr.js";

const rowText = (screen, row) =>
  Array.from({ length: screen.cols }, (_, i) => screen.get(row, i + 1))
    .map((c) => (c.mosaic ? "#" : c.char))
    .join("");

test("businesses are numbered page by page, west to east, north first on ties", () => {
  const numbered = numberedBusinesses();
  assert.equal(numbered.length, businesses.length);
  numbered.forEach((b, i) => assert.equal(b.number, i + 1));
  for (let i = 1; i < numbered.length; i++) {
    const prev = numbered[i - 1];
    const cur = numbered[i];
    assert.ok(
      prev.page < cur.page ||
        (prev.page === cur.page &&
          (prev.col < cur.col || (prev.col === cur.col && prev.side === "N"))),
      `${prev.name} before ${cur.name}`,
    );
  }
});

test("there are three pages and every business lands on exactly one", () => {
  assert.equal(pageCount(), 3);
  const all = [0, 1, 2].flatMap((p) => businessesOnPage(p));
  assert.equal(all.length, businesses.length);
  assert.ok(businessesOnPage(0).every((b) => b.col + 1 <= 40));
  assert.equal(businessesOnPage(0).length, 6);
});

test("the home page is the one holding Slice of Life", () => {
  assert.equal(homePage(), 1);
  assert.ok(businessesOnPage(homePage()).some((b) => b.name === SLICE_NAME));
});

test("map page has title, page indicator and separator", () => {
  const s = renderMapPage(1);
  assert.equal(s.rows, 24);
  assert.equal(s.cols, 40);
  assert.equal(rowText(s, 1).slice(1, 15), "VENABLES VIBES");
  assert.equal(rowText(s, 1).slice(36, 39), "2/3");
  assert.equal(s.get(1, 2).fg, 3);
  assert.equal(rowText(s, 2), "#".repeat(40));
  assert.equal(s.get(2, 1).char, 12);
});

test("map page draws the street band with its label", () => {
  const s = renderMapPage(0);
  for (const row of [7, 8, 9]) {
    for (let col = 1; col <= 40; col++) {
      assert.equal(s.get(row, col).bg, 3, `row ${row} col ${col}`);
    }
  }
  assert.equal(rowText(s, 8).slice(20, 31), "VENABLES ST");
  assert.equal(s.get(8, 21).fg, 0);
  assert.equal(s.get(8, 20).char, " ");
});

test("map page draws cross streets as vertical yellow bands with a contiguous name", () => {
  const s = renderMapPage(0);
  const woodland = pages[0].streets[0];
  for (let row = 3; row <= 13; row++) {
    for (let col = woodland.col; col <= woodland.col + 2; col++) {
      assert.equal(s.get(row, col).bg, 3, `row ${row} col ${col}`);
    }
  }
  const letters = Array.from({ length: 11 }, (_, i) => s.get(3 + i, woodland.col + 1).char).join("");
  assert.equal(letters, " WOODLAND  ");
  assert.equal(s.get(4, woodland.col + 1).fg, 0);
  assert.equal(s.get(3, woodland.col).char, " ");
});

test("a north-only cross street stops at the street band", () => {
  const s = renderMapPage(1);
  const street = pages[1].streets.find((x) => x.side === "N");
  const col = street.col;
  for (let row = 3; row <= 9; row++) {
    for (let c = col; c <= col + 2; c++) {
      assert.equal(s.get(row, c).bg, 3, `row ${row} col ${c}`);
    }
  }
  for (let row = 10; row <= 13; row++) assert.equal(s.get(row, col).bg, 0, `row ${row}`);
  const letters = [3, 4, 5, 6, 7, 8, 9].map((r) => s.get(r, col + 1).char).join("");
  assert.equal(letters, " ".repeat(7));
});

test("a south-only cross street starts at the street band and shows on both pages", () => {
  const first = renderMapPage(0);
  const street = pages[0].streets.find((x) => x.side === "S");
  const col = street.col;
  for (let row = 7; row <= 13; row++) {
    for (let c = col; c <= col + 2; c++) {
      assert.equal(first.get(row, c).bg, 3, `row ${row} col ${c}`);
    }
  }
  for (let row = 3; row <= 6; row++) assert.equal(first.get(row, col + 2).bg, 0, `row ${row}`);
  const letters = [7, 8, 9, 10, 11, 12, 13].map((r) => first.get(r, col + 1).char).join("");
  assert.equal(letters, "COTTON ");

  const second = renderMapPage(1);
  const secondLetters = [7, 8, 9, 10, 11, 12, 13].map((r) => second.get(r, 2).char).join("");
  assert.equal(secondLetters, "COTTON ");
  assert.equal(second.get(13, 1).bg, 3);
});

test("map page places pins by side and tier without stems", () => {
  const s = renderMapPage(1);
  const raven = numberedBusinesses().find((b) => b.name === "Raven's Veil");
  const col = raven.col;
  assert.equal(rowText(s, 3).slice(col - 1, col + 1), String(raven.number).padStart(2, "0"));
  assert.equal(s.get(3, col).inverse, true);
  for (let row = 3; row <= 13; row++) {
    for (let c = 1; c <= 40; c++) assert.notEqual(s.get(row, c).char, "|", `row ${row} col ${c}`);
  }

  const slice = numberedBusinesses().find((b) => b.name === SLICE_NAME);
  const sliceCol = slice.col;
  assert.equal(rowText(s, 10).slice(sliceCol - 1, sliceCol + 1), String(slice.number).padStart(2, "0"));
  assert.equal(s.get(10, sliceCol).flash, true);
  assert.equal(s.get(10, sliceCol).fg, 7);
  assert.equal(s.get(10, sliceCol).inverse, true);
  assert.equal(s.get(3, col).flash, false);
});

test("map page legend lists the page's businesses in order", () => {
  const s = renderMapPage(1);
  const onPage = businessesOnPage(1);
  assert.equal(onPage.length, 7);
  assert.ok(businessesOnPage(2).some((b) => b.name === "VanCity Pinball"));
  assert.ok(businessesOnPage(2).some((b) => b.name === "FUN HAUS"));
  onPage.forEach((b, i) => {
    const row = 15 + i;
    assert.equal(rowText(s, row).slice(0, 2), String(b.number).padStart(2, "0"));
    assert.equal(s.get(row, 1).inverse, true);
    assert.equal(s.get(row, 1).fg, 7);
    assert.equal(rowText(s, row).slice(3, 3 + b.name.length), b.name);
    assert.equal(s.get(row, 4).fg, b.name === SLICE_NAME ? 3 : 7);
    if (b.note) {
      assert.equal(s.get(row, 4 + b.name.length + 1).fg, 2);
    }
  });
  assert.equal(rowText(s, 23).trim(), "");
  assert.equal(rowText(s, 24).trim(), "");
  assert.equal(rowText(renderMapPage(2), 15 + businessesOnPage(2).length).trim(), "");
});

test("a blank row separates the map from the legend and the legend from the footer", () => {
  for (const page of [0, 1, 2]) {
    const s = renderMapPage(page);
    assert.equal(rowText(s, 14), " ".repeat(40), `page ${page + 1} row 14`);
    for (let col = 1; col <= 40; col++) assert.deepEqual(s.get(14, col), DEFAULT_CELL);
    assert.equal(rowText(s, 22), " ".repeat(40), `page ${page + 1} row 22`);
  }
});

test("the top-left corner of the map stays free for the compass", () => {
  for (const page of [0, 1, 2]) {
    const s = renderMapPage(page);
    for (let row = 3; row <= 5; row++) {
      for (let col = 1; col <= 3; col++) {
        assert.deepEqual(s.get(row, col), DEFAULT_CELL, `page ${page + 1} row ${row} col ${col}`);
      }
    }
  }
});

test("every real note fits its legend row without scrolling", () => {
  for (const page of [0, 1, 2]) {
    businessesOnPage(page).forEach((b) => {
      const room = 40 - (4 + b.name.length + 1) + 1;
      assert.ok(b.note.length <= room, `${b.name}: "${b.note}" needs ${b.note.length}, has ${room}`);
    });
  }
});

test("legend notes are truncated at column 40", () => {
  for (const page of [0, 1, 2]) {
    const s = renderMapPage(page, overflowing);
    businessesOnPage(page, overflowing).forEach((b, i) => {
      const noteCol = 4 + b.name.length + 1;
      const visible = b.note.slice(0, s.cols - noteCol + 1);
      assert.equal(
        rowText(s, 15 + i).slice(noteCol - 1, noteCol - 1 + visible.length),
        visible,
        `${b.name} note`,
      );
    });
  }

  const s = renderMapPage(0, overflowing);
  const onPage = businessesOnPage(0, overflowing);
  const b = onPage.find((x) => x.name === "The Front Supply Co");
  const row = 15 + onPage.indexOf(b);
  const noteCol = 4 + b.name.length + 1;
  const room = s.cols - noteCol + 1;
  assert.ok(b.note.length > room, "the sample note must overflow the row");
  assert.equal(rowText(s, row).slice(noteCol - 1), b.note.slice(0, room));
  assert.equal(s.get(row, s.cols).char, b.note[room - 1]);
  assert.equal(s.get(row, s.cols).fg, 2);
});

test("marqueeWindow cycles a long note through a fixed width with a gap", () => {
  assert.equal(marqueeWindow("abcdef", 4, 0), "abcd");
  assert.equal(marqueeWindow("abcdef", 4, 2), "cdef");
  assert.equal(marqueeWindow("abcdef", 4, 5), "f   ");
  assert.equal(marqueeWindow("abcdef", 4, 6), "   a");
  assert.equal(marqueeWindow("abcdef", 4, 8), " abc");
  assert.equal(marqueeWindow("abcdef", 4, 9), "abcd");
});

test("renderLegendNotes redraws only the overflowing notes, shifted by the offset", () => {
  const page = 0;
  const onPage = businessesOnPage(page, overflowing);
  const frame = renderLegendNotes(page, 0, overflowing);
  const staticPage = renderMapPage(page, overflowing);
  let scrolling = 0;
  onPage.forEach((b, i) => {
    const row = 15 + i;
    const noteCol = 4 + b.name.length + 1;
    const room = 40 - noteCol + 1;
    if (b.note.length > room) {
      scrolling++;
      for (let c = noteCol; c <= 40; c++) {
        assert.deepEqual(frame.get(row, c), staticPage.get(row, c), `${b.name} col ${c}`);
      }
      assert.deepEqual(frame.get(row, 1), DEFAULT_CELL);
      assert.deepEqual(frame.get(row, 4), DEFAULT_CELL);
      const shifted = renderLegendNotes(page, 3, overflowing);
      const text = Array.from({ length: room }, (_, k) => shifted.get(row, noteCol + k).char).join("");
      assert.equal(text, marqueeWindow(b.note, room, 3));
      assert.equal(shifted.get(row, noteCol).fg, 2);
    } else {
      assert.deepEqual(frame.get(row, noteCol), DEFAULT_CELL, b.name);
    }
  });
  assert.equal(scrolling, 1, "the fixture has exactly one overflowing note");
  for (let row = 1; row <= 13; row++) {
    for (let c = 1; c <= 40; c++) assert.deepEqual(frame.get(row, c), DEFAULT_CELL);
  }
});

test("QR page centers the bitmap under a title", () => {
  const bitmap = Array.from({ length: 66 }, () => new Uint8Array(66).fill(1));
  const s = renderQrPage(bitmap);
  assert.equal(rowText(s, 1).trim(), "SCAN TO OPEN IN GOOGLE MAPS");
  assert.equal(s.get(2, 4).mosaic, true);
  assert.equal(s.get(2, 4).char, 63);
  assert.equal(s.get(2, 4).fg, 0);
  assert.equal(s.get(2, 4).bg, 7);
  assert.equal(s.get(23, 36).mosaic, true);
  for (const col of [3, 37]) {
    const cell = s.get(2, col);
    assert.equal(cell.mosaic, true, `col ${col}`);
    assert.equal(cell.char, 0, `col ${col}`);
    assert.equal(cell.bg, 7, `col ${col}`);
  }
  assert.equal(s.get(1, 1).mosaic, false);
  assert.equal(s.get(1, 1).bg, 0);
  assert.equal(rowText(s, 24), " ".repeat(40));
  assert.equal(s.get(24, 1).bg, 0);
});

test("QR page rejects bitmaps that do not fit", () => {
  const tall = Array.from({ length: 69 }, () => new Uint8Array(66));
  assert.throws(() => renderQrPage(tall));
  const wide = Array.from({ length: 66 }, () => new Uint8Array(76));
  assert.throws(() => renderQrPage(wide));
});

const scanVideotex = (bytes) => {
  const problems = [];
  let mosaic = false;
  let i = 0;
  while (i < bytes.length) {
    const b = bytes.charCodeAt(i);
    if (b === 0x1f) {
      i += 3;
    } else if (b === 0x12) {
      i += 2;
    } else if (b === 0x0e) {
      mosaic = true;
      i += 1;
    } else if (b === 0x0f) {
      mosaic = false;
      i += 1;
    } else if (b === 0x1b) {
      const code = bytes.charCodeAt(i + 1);
      i += 2;
      if (mosaic || code < 0x50 || code > 0x57) continue;
      let j = i;
      while (
        bytes.charCodeAt(j) === 0x1b &&
        [0x5c, 0x5d, 0x48, 0x49].includes(bytes.charCodeAt(j + 1))
      ) {
        j += 2;
      }
      if (bytes.charCodeAt(j) !== 0x20) {
        problems.push(`byte ${i - 2}: bg ${code - 0x50} in text mode not followed by a space`);
      }
    } else {
      if (mosaic && !((b >= 0x20 && b <= 0x3f) || (b >= 0x60 && b <= 0x7f))) {
        problems.push(`byte ${i}: mosaic glyph 0x${b.toString(16)} outside 0x20-0x3F / 0x60-0x7F`);
      }
      i += 1;
    }
  }
  return problems;
};

test("encoded pages keep background changes on spaces and mosaic glyphs in range", () => {
  const pages = [
    ...[0, 1, 2].map((p) => [`map page ${p + 1}`, encode(renderMapPage(p))]),
    ["qr page", encode(renderQrPage(qrBitmap(MAP_URL)))],
  ];
  for (const [name, bytes] of pages) {
    assert.deepEqual(scanVideotex(bytes), [], name);
  }
});
