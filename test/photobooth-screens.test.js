import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CELL } from "../screen.js";
import {
  FILTERS,
  renderIdle,
  renderBar,
  renderCountdown,
  renderPicture,
  renderSmile,
  renderQr,
  renderUrl,
} from "../slice/photobooth-screens.js";

const rowText = (screen, row) =>
  Array.from({ length: screen.cols }, (_, i) => screen.get(row, i + 1))
    .map((c) => (c.mosaic ? "#" : c.char))
    .join("");
const mosaicCount = (screen) => {
  let n = 0;
  for (let r = 1; r <= screen.rows; r++) for (let c = 1; c <= screen.cols; c++) if (screen.get(r, c).mosaic) n++;
  return n;
};

test("filters start with poster and cover every preset once", () => {
  assert.equal(FILTERS[0], "poster");
  assert.deepEqual([...FILTERS].sort(), ["halftone", "newsprint", "photo", "poster", "sketch", "smooth", "stencil", "stripes", "typewriter"]);
});

test("idle shows the prompt and a bar with SPACE and SOMMAIRE", () => {
  const s = renderIdle();
  assert.match(rowText(s, 12), /press space to capture/);
  const bar = rowText(s, 24);
  assert.match(bar, /SPACE.*capture.*SOMMAIRE.*menu/);
  assert.doesNotMatch(bar, / F /);
  assert.equal(s.get(24, bar.indexOf("SPACE") + 1).inverse, true);
  assert.deepEqual(s.get(1, 1), DEFAULT_CELL);
});

test("the captured bar offers filter and download", () => {
  const s = renderIdle();
  renderBar(s, { captured: true });
  const bar = rowText(s, 24);
  assert.match(bar, /SPACE.*capture.*F.*filter.*D.*download/);
  assert.doesNotMatch(bar, /SOMMAIRE/);
  assert.equal(s.get(24, bar.indexOf(" D ") + 2).inverse, true);
});

test("countdown draws a large digit in the middle of a black screen", () => {
  const drawn = [3, 2, 1].map((d) => renderCountdown(d));
  for (const s of drawn) {
    assert.ok(mosaicCount(s) > 20);
    assert.deepEqual(s.get(1, 1), DEFAULT_CELL);
    assert.deepEqual(s.get(24, 40), DEFAULT_CELL);
    assert.ok(s.get(12, 20).mosaic || s.get(12, 21).mosaic);
  }
  assert.notDeepEqual(drawn[0].cells, drawn[1].cells);
});

test("picture paints the cells and draws the captured bar over row 24", () => {
  const cells = Array.from({ length: 24 }, () => Array.from({ length: 40 }, () => ({ bits: 63, fg: 5, bg: 5 })));
  const s = renderPicture(cells);
  assert.deepEqual(s.get(1, 1), { ...DEFAULT_CELL, mosaic: true, char: 63, fg: 5, bg: 5 });
  assert.match(rowText(s, 24), /download/);
});

test("smile is a centred message", () => {
  assert.match(rowText(renderSmile(), 12), /smile/);
});

test("qr page fills the screen with a code and falls back to text for long urls", () => {
  const url = "https://3615.ucodia.space/photobooth/0123abcd-typewriter.png";
  const s = renderQr(url);
  assert.ok(s, "fits");
  assert.equal(s.get(1, 1).bg, 7, "white quiet zone");
  assert.ok(mosaicCount(s) > 500);
  assert.equal(renderQr("https://a-very-long-hostname.example.com/photobooth/0123abcd-typewriter.png?x=1234567"), null);
  const t = renderUrl(url);
  assert.match(rowText(t, 12) + rowText(t, 13), /3615\.ucodia\.space/);
});
