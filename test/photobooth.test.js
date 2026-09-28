import { test } from "node:test";
import assert from "node:assert/strict";
import { createPhotobooth, hashOf, convertAll } from "../slice/photobooth.js";
import sharp from "sharp";
import { FILTERS, FILTER_CODES, renderIdle, renderPicture, renderCountdown } from "../slice/photobooth-screens.js";
import { encode } from "../screen.js";
import { LEVELS } from "../image/levels.js";

// A Minitel stand-in: records calls, feeds scripted keys, and, like the real
// class, drops keys pressed while nobody is reading.
function stubMinitel(script) {
  const calls = [];
  const queue = [...script];
  let pending = null;
  const m = {
    sommaire: 6, envoi: 1, noir: 0, blanc: 7,
    calls,
    async home() { calls.push(["home"]); },
    async cls() { calls.push(["cls"]); },
    async send(data) { calls.push(["send", data]); },
    async pos(r, c) { calls.push(["pos", r, c]); },
    async print(t) { calls.push(["print", t]); },
    async inverse(v = 1) { calls.push(["inverse", v]); },
    async color(c) { calls.push(["color", c]); },
    async plot(ch, n) { calls.push(["plot", ch, n]); },
    press(char) { if (pending) { const r = pending; pending = null; r(char); } },
    async key() {
      calls.push(["key"]);
      if (queue.length) {
        const next = queue.shift();
        return typeof next === "number" ? ["", next] : [next, 0];
      }
      const char = await new Promise((resolve) => { pending = resolve; });
      return typeof char === "number" ? ["", char] : [char, 0];
    },
  };
  return m;
}

const JPEG = Buffer.from("fake jpeg bytes");
function fakeCells(tag) {
  return Array.from({ length: 24 }, () => Array.from({ length: 40 }, () => ({ bits: tag, fg: 7, bg: 0 })));
}
const fakeConvert = async () => new Map(FILTERS.map((name, i) => [name, fakeCells(i + 1)]));

function harness(script, overrides = {}) {
  const m = stubMinitel(script);
  const camera = { captures: 0, capture: async () => { camera.captures++; return JPEG; } };
  const store = { published: [], publish: async (name) => { store.published.push(name); return { path: name, created: true }; } };
  const renders = [];
  const booth = createPhotobooth({
    camera, store, publicUrl: "https://3615.ucodia.space",
    makeMinitel: () => m,
    sleep: async () => {},
    render: async (cells) => { renders.push(cells); return Buffer.from("png"); },
    convert: fakeConvert,
    log: { info() {}, warn() {} },
    ...overrides,
  });
  return { m, camera, store, renders, run: () => booth({}) };
}
const sends = (m) => m.calls.filter((c) => c[0] === "send").map((c) => c[1]);
const messages = (m) => {
  let at = null;
  const out = [];
  for (const c of m.calls) {
    if (c[0] === "pos") at = `${c[1]},${c[2]}`;
    else if (c[0] === "print" && at === "0,15" && c[1].trim()) out.push(c[1].trim());
  }
  return out;
};
const hintDraws = (m) => m.calls.filter((c, i) => c[0] === "pos" && c[1] === 0 && c[2] === 1 && m.calls.slice(i, i + 4).some((n) => n[0] === "print" && n[1] === "SOMMAIRE")).length;

test("hashOf is the first 8 hex chars of sha256", () => {
  assert.match(hashOf(JPEG), /^[0-9a-f]{7}$/);
  assert.equal(hashOf(JPEG), hashOf(Buffer.from("fake jpeg bytes")));
  assert.notEqual(hashOf(JPEG), hashOf(Buffer.from("other")));
});

test("sommaire leaves the idle screen", async () => {
  const { m, run } = harness([6]);
  assert.equal(await run(), 6);
  assert.deepEqual(sends(m), [encode(renderIdle())]);
});

test("space counts down, captures, converts and shows poster", async () => {
  const { m, camera, run } = harness([" ", 6]);
  await run();
  assert.equal(camera.captures, 1);
  const s = sends(m);
  assert.deepEqual(s.slice(1, 4), [3, 2, 1].map((d) => encode(renderCountdown(d))));
  assert.equal(s[s.length - 1], encode(renderPicture(fakeCells(1))));
});

test("f cycles filters silently and wraps", async () => {
  const { m, run } = harness([" ", "f", "F", ...Array(FILTERS.length - 2).fill("f"), 6]);
  await run();
  assert.deepEqual(messages(m), [], "no notification on a filter change");
  const pictures = sends(m).filter((s) => s === encode(renderPicture(fakeCells(2))));
  assert.equal(pictures.length, 1, "photo shown once");
  assert.equal(sends(m).at(-1), encode(renderPicture(fakeCells(1))));
});

test("every screen carries the sommaire hint on the status row after the clear", async () => {
  const { m, run } = harness([" ", "f", "d", "x", 6]);
  await run();
  const clears = m.calls.filter((c) => c[0] === "cls").length;
  assert.ok(clears >= 6, "idle, countdown, smile, picture, qr, picture");
  assert.equal(hintDraws(m), clears - 1, "one hint per cleared screen except the download page");
  const qrAt = m.calls.findIndex((c) => c[0] === "send" && /\/p\//.test(c[1]));
  const qrClear = m.calls.findLastIndex((c, i) => i < qrAt && c[0] === "cls");
  const backAt = m.calls.findIndex((c, i) => i > qrAt && c[0] === "cls");
  assert.ok(!m.calls.slice(qrClear, backAt).some((c) => c[0] === "print" && c[1] === "SOMMAIRE"), "no menu hint on the download page");
  const firstSend = m.calls.findIndex((c) => c[0] === "send");
  assert.ok(m.calls.slice(0, firstSend).some((c) => c[0] === "print" && c[1] === "SOMMAIRE"), "the hint goes out before the first screen's bytes");
  for (const c of m.calls) if (c[0] === "print" && !c[1].startsWith("SOMMAIRE") && c[1] !== " menu") assert.ok(c[1].length <= 23, `notification fits left of the hint: ${JSON.stringify(c[1])}`);
});

test("the sommaire hint is not on the idle bar any more", async () => {
  const { m, run } = harness([6]);
  await run();
  assert.equal(sends(m)[0], encode(renderIdle()));
  assert.ok(!/SOMMAIRE/.test(sends(m)[0]), "the hint lives on the status row");
});

test("keys are read while a notification is still displayed", async () => {
  const { m, run } = harness(["x", "x", 6]);
  const result = await Promise.race([run(), new Promise((r) => setTimeout(() => r("hung"), 500))]);
  assert.equal(result, 6, "the page waited for the notification to clear before reading the next key");
  assert.deepEqual(messages(m), ["keys at the bottom", "keys at the bottom"]);
  assert.ok(!m.calls.some((c) => c[0] === "plot" && c[1] === " "), "no erase was sent while keys kept coming");
});

test("d before capture only shows the hint", async () => {
  const { m, store, run } = harness(["d", "f", 6]);
  await run();
  assert.deepEqual(store.published, []);
  assert.deepEqual(messages(m), ["keys at the bottom", "keys at the bottom"]);
});

test("d publishes once per filter, shows the qr and returns to the picture on a key", async () => {
  const { m, store, renders, run } = harness([" ", "d", "x", "d", "x", "f", "d", "x", 6]);
  await run();
  const hash = hashOf(JPEG);
  assert.deepEqual(store.published, [`${hash}-poster.png`, `${hash}-poster.png`, `${hash}-photo.png`]);
  const shown = sends(m).filter((s) => /\/p\//.test(s)).at(-1);
  assert.ok(shown.includes(`/p/${hash}`) && shown.includes("-photo.png"), "the last qr page names the photo file");
  assert.equal(renders.length, 2, "poster rendered once, photo once");
  assert.ok(shown.includes("scan to download - expires in 5 min"), "the caption is part of the qr page");
  assert.ok(!m.calls.some((c) => c[0] === "print" && /scan to download/.test(c[1])), "the caption is not a status-row print");
  assert.equal(sends(m).at(-1), encode(renderPicture(fakeCells(2))));
});

test("the caption follows the configured ttl", async () => {
  const { m, run } = harness([" ", "d", "x", 6], { ttl: 120 });
  await run();
  const shown = sends(m).filter((s) => /\/p\//.test(s)).at(-1);
  assert.ok(shown.includes("scan to download - expires in 2 min"));
});

test("space during capture is ignored", async () => {
  const { m, camera, run } = harness([" "], {});
  camera.capture = async () => { camera.captures++; m.press(" "); return JPEG; };
  setTimeout(() => m.press(6), 20);
  await run();
  assert.equal(camera.captures, 1);
});

test("capture failure shows a message and stays idle", async () => {
  const failing = { capture: async () => { throw new Error("no camera"); } };
  const { m, run } = harness([" ", 6], { camera: failing });
  await run();
  assert.ok(messages(m).includes("camera not available"));
  assert.equal(sends(m).at(-1), encode(renderIdle()));
});

test("sommaire on the qr page returns to the picture; a second one leaves", async () => {
  const { m, run } = harness([" ", "d", 6, 6]);
  const result = await Promise.race([run(), new Promise((r) => setTimeout(() => r("hung"), 500))]);
  assert.equal(result, 6, "the page kept waiting for a key");
  const keys = m.calls.filter((c) => c[0] === "key").length;
  assert.equal(keys, 4, "sommaire on the qr page is consumed, the next one leaves");
  assert.equal(sends(m).at(-1), encode(renderPicture(fakeCells(1))), "back on the picture before leaving");
  m.press(6);
});

test("the qr page returns to the picture by itself after the timeout", async () => {
  const { m, run } = harness([" ", "d"], { qrTimeoutMs: 30 });
  setTimeout(() => m.press(6), 150);
  const result = await Promise.race([run(), new Promise((r) => setTimeout(() => r("hung"), 1000))]);
  assert.equal(result, 6);
  const all = sends(m);
  const qrAt = all.findIndex((s) => /\/p\//.test(s));
  assert.ok(qrAt >= 0, "the qr page was shown");
  assert.equal(all[qrAt + 1], encode(renderPicture(fakeCells(1))), "the picture came back without a key press");
});

test("a url too long for a qr falls back to text", async () => {
  const { m, run } = harness([" ", "d", "x", 6], { publicUrl: "https://a-very-long-hostname.example.com/with/a/rather/long/path" });
  await run();
  assert.ok(sends(m).some((s) => /open this address/.test(s)));
  assert.ok(!sends(m).some((s) => /scan to download/.test(s)));
});

test("convertAll applies the gamma to the field", async () => {
  const width = 160, height = 120;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.fill(Math.round((x / (width - 1)) * 255), (y * width + x) * 3, (y * width + x) * 3 + 3);
  const jpeg = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg().toBuffer();
  const plain = await convertAll(jpeg);
  const lifted = await convertAll(jpeg, { gamma: 0.5 });
  const brightness = (grid) => grid.flat().reduce((sum, cell) => sum + LEVELS[cell.fg ?? 0] + LEVELS[cell.bg ?? 0], 0);
  assert.ok(brightness(lifted.get("poster")) > brightness(plain.get("poster")), "gamma below 1 brightens the mid-tones");
});

test("the raw jpeg is handed to dump with its hash after a capture", async () => {
  const dumped = [];
  const { run } = harness([" ", 6], { dump: async (jpeg, hash) => { dumped.push([jpeg.toString(), hash]); } });
  await run();
  assert.deepEqual(dumped, [[JPEG.toString(), hashOf(JPEG)]]);
});

test("a failing dump does not break the capture", async () => {
  const { m, run } = harness([" ", 6], { dump: async () => { throw new Error("disk full"); } });
  await run();
  assert.equal(sends(m).at(-1), encode(renderPicture(fakeCells(1))));
});

test("convertAll produces one 40x24 grid per filter from a real jpeg", async () => {
  const jpeg = await sharp({ create: { width: 160, height: 120, channels: 3, background: { r: 120, g: 120, b: 120 } } }).jpeg().toBuffer();
  const cells = await convertAll(jpeg);
  assert.deepEqual([...cells.keys()], [...FILTERS]);
  for (const [name, grid] of cells) {
    assert.equal(grid.length, 24, name);
    assert.equal(grid[0].length, 40, name);
    assert.equal("char" in grid[0][0], name === "typewriter", name);
  }
});

test("filter codes are short, unique, lowercase and cover every filter", () => {
  for (const name of FILTERS) assert.ok(name in FILTER_CODES, `${name} has a code`);
  const codes = Object.values(FILTER_CODES);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^[a-z]{3,7}$/);
  assert.equal(FILTER_CODES.typewriter, "type");
});

test("d publishes under the short filter code", async () => {
  const { store, run } = harness([" ", ...Array(FILTERS.length - 1).fill("f"), "d", "x", 6]);
  await run();
  assert.deepEqual(store.published, [`${hashOf(JPEG)}-type.png`]);
});
