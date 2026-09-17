import { test } from "node:test";
import assert from "node:assert/strict";
import { pages, CANVAS_ROWS, PAGE_COLS, SLICE_NAME } from "../slice/venables-data.js";

const ascii = /^[\x20-\x7e]*$/;
const all = pages.flatMap((p) => p.businesses);

test("every business has a valid shape and fits its page", () => {
  for (const b of all) {
    assert.ok(b.name.length > 0 && b.name.length <= 20, b.name);
    assert.match(b.name, ascii, b.name);
    assert.match(b.note, ascii, b.name);
    assert.ok(["N", "S"].includes(b.side), b.name);
    assert.ok([0, 1, 2].includes(b.tier), b.name);
    assert.ok(Number.isInteger(b.col) && b.col >= 1 && b.col + 1 <= PAGE_COLS, b.name);
  }
});

test("business names are unique and exactly one is Slice of Life", () => {
  assert.equal(new Set(all.map((b) => b.name)).size, all.length);
  assert.equal(all.filter((b) => b.name === SLICE_NAME).length, 1);
});

test("no page holds more than 7 businesses so the legend keeps a blank row above the footer", () => {
  pages.forEach((p, i) => assert.ok(p.businesses.length <= 7, `page ${i + 1}`));
});

test("pins keep clear of cross street bands on their side", () => {
  for (const p of pages) {
    for (const b of p.businesses) {
      for (const street of p.streets) {
        if (street.side !== "both" && street.side !== b.side) continue;
        const clear = b.col + 1 < street.col || b.col > street.col + 3;
        assert.ok(clear, `${b.name} vs ${street.name || "unnamed"} at ${street.col}`);
      }
    }
  }
});

test("pins on the same side of a page are at least 3 columns apart", () => {
  for (const p of pages) {
    for (const a of p.businesses) {
      for (const b of p.businesses) {
        if (a === b || a.side !== b.side) continue;
        assert.ok(Math.abs(a.col - b.col) >= 3, `${a.name} vs ${b.name}`);
      }
    }
  }
});

test("cross streets and labels fit their page", () => {
  for (const p of pages) {
    for (const s of p.streets) {
      assert.ok(s.col >= 1 && s.col + 2 <= PAGE_COLS, s.name);
      assert.ok(["both", "N", "S"].includes(s.side), s.name);
      assert.match(s.name, ascii, s.name);
      if (s.label !== false) {
        assert.ok(s.name.length <= (s.side === "both" ? CANVAS_ROWS : 7), s.name);
      }
    }
    assert.ok(p.labelCol >= 1 && p.labelCol + 10 <= PAGE_COLS, `label col ${p.labelCol}`);
    for (const s of p.streets) {
      const overlaps = s.col <= p.labelCol + 10 && s.col + 2 >= p.labelCol;
      assert.ok(!overlaps, `label overlaps ${s.name || "unnamed"} at ${s.col}`);
    }
  }
});
