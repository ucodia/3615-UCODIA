import { test } from "node:test";
import assert from "node:assert/strict";
import { Screen, encode, DEFAULT_CELL } from "../screen.js";

const POS = (row, col) => `\x1f${String.fromCharCode(64 + row)}${String.fromCharCode(64 + col)}`;

test("new screen is filled with default cells", () => {
  const s = new Screen(2, 3);
  assert.deepEqual(s.get(1, 1), DEFAULT_CELL);
  assert.deepEqual(s.get(2, 3), DEFAULT_CELL);
});

test("set merges a partial cell over the default", () => {
  const s = new Screen(2, 3);
  s.set(1, 2, { char: "X", fg: 3 });
  assert.deepEqual(s.get(1, 2), { ...DEFAULT_CELL, char: "X", fg: 3 });
});

test("writes outside the grid are ignored", () => {
  const s = new Screen(2, 3);
  s.set(3, 1, { char: "X" });
  s.set(1, 4, { char: "X" });
  s.text(2, 3, "AB");
  assert.equal(s.get(2, 3).char, "A");
  assert.deepEqual(s.get(1, 1), DEFAULT_CELL);
});

test("text writes one cell per character with attributes", () => {
  const s = new Screen(1, 5);
  s.text(1, 2, "AB", { fg: 2, inverse: true });
  assert.deepEqual(s.get(1, 2), { ...DEFAULT_CELL, char: "A", fg: 2, inverse: true });
  assert.deepEqual(s.get(1, 3), { ...DEFAULT_CELL, char: "B", fg: 2, inverse: true });
  assert.deepEqual(s.get(1, 4), DEFAULT_CELL);
});

test("text rejects non-ASCII characters", () => {
  const s = new Screen(1, 5);
  assert.throws(() => s.text(1, 1, "→"));
});

test("set rejects a multi-character string", () => {
  const s = new Screen(1, 5);
  assert.throws(() => s.set(1, 1, { char: "AB" }));
  assert.throws(() => s.set(1, 1, { char: "é" }));
});

test("set rejects mosaic bits outside 0-63", () => {
  const s = new Screen(1, 5);
  assert.throws(() => s.set(1, 1, { mosaic: true, char: 64 }));
  assert.throws(() => s.set(1, 1, { mosaic: true, char: -1 }));
  assert.throws(() => s.set(1, 1, { mosaic: true, char: "A" }));
});

test("fill sets a rectangle inclusive of both corners", () => {
  const s = new Screen(3, 3);
  s.fill(1, 2, 2, 3, { bg: 3 });
  assert.equal(s.get(1, 2).bg, 3);
  assert.equal(s.get(2, 3).bg, 3);
  assert.equal(s.get(3, 3).bg, 0);
  assert.equal(s.get(1, 1).bg, 0);
});

test("blit copies a window from another screen", () => {
  const src = new Screen(2, 6);
  src.text(1, 3, "ABCD");
  const dst = new Screen(4, 4);
  dst.blit(src, 1, 3, 2, 2, 3, 2);
  assert.equal(dst.get(3, 2).char, "A");
  assert.equal(dst.get(3, 3).char, "B");
  assert.equal(dst.get(4, 2).char, " ");
  assert.deepEqual(dst.get(3, 4), DEFAULT_CELL);
});

test("encode emits nothing for an empty screen", () => {
  assert.equal(encode(new Screen(2, 4)), "");
});

test("encode positions each row at its first non-empty cell and selects text mode", () => {
  const s = new Screen(2, 4);
  s.text(2, 2, "AB");
  assert.equal(encode(s), `${POS(2, 2)}\x0fAB`);
});

test("encode keeps interior default cells as spaces", () => {
  const s = new Screen(1, 5);
  s.text(1, 2, "A");
  s.text(1, 4, "B");
  assert.equal(encode(s), `${POS(1, 2)}\x0fA B`);
});

test("encode emits attribute changes only when they change", () => {
  const s = new Screen(1, 4);
  s.text(1, 1, "AB", { fg: 3, bg: 4, inverse: true, flash: true });
  s.text(1, 3, "C", { fg: 3 });
  assert.equal(
    encode(s),
    `${POS(1, 1)}\x0f\x1bC\x1bT\x1b]\x1bHAB\x1bP\x1b\\\x1bIC`,
  );
});

test("encode resets attribute state on every row", () => {
  const s = new Screen(2, 2);
  s.text(1, 1, "A", { fg: 3 });
  s.text(2, 1, "B", { fg: 3 });
  assert.equal(encode(s), `${POS(1, 1)}\x0f\x1bCA${POS(2, 1)}\x0f\x1bCB`);
});

test("encode compresses runs of identical cells with the repeat code", () => {
  const s = new Screen(1, 10);
  s.text(1, 1, "-----", { fg: 3 });
  s.text(1, 6, "--");
  assert.equal(encode(s), `${POS(1, 1)}\x0f\x1bC-\x12D\x1bG--`);
});

test("encode splits repeat counts above 63", () => {
  const s = new Screen(1, 80);
  s.fill(1, 1, 1, 80, { char: "=" });
  assert.equal(encode(s), `${POS(1, 1)}\x0f=\x12\x7f\x12P`);
});

test("encode re-emits inverse after a mode switch clears it", () => {
  const s = new Screen(1, 2);
  s.set(1, 1, { char: "A", inverse: true });
  s.set(1, 2, { mosaic: true, char: 63, inverse: true });
  assert.equal(encode(s), `${POS(1, 1)}\x0f\x1b]A\x0e\x1b]\x7f`);
});

test("encode switches to mosaic mode and maps bits to videotex codes", () => {
  const s = new Screen(1, 4);
  s.set(1, 1, { mosaic: true, char: 63, fg: 3 });
  s.set(1, 2, { mosaic: true, char: 32, fg: 3 });
  s.set(1, 3, { mosaic: true, char: 0, fg: 3 });
  s.set(1, 4, { char: "A", fg: 3 });
  assert.equal(encode(s), `${POS(1, 1)}\x0e\x1bC\x7f\x60\x20\x0fA`);
});
