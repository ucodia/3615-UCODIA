import { test } from "node:test";
import assert from "node:assert/strict";
import { createPhotobooth, hashOf, convertAll } from "../slice/photobooth.js";
import sharp from "sharp";
import { FILTERS, renderIdle, renderPicture, renderCountdown } from "../slice/photobooth-screens.js";
import { encode } from "../screen.js";

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
    async message(row, col, delay, text) { calls.push(["message", text]); },
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
const messages = (m) => m.calls.filter((c) => c[0] === "message").map((c) => c[1]);

test("hashOf is the first 8 hex chars of sha256", () => {
  assert.match(hashOf(JPEG), /^[0-9a-f]{8}$/);
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

test("f cycles filters with a notification and wraps", async () => {
  const { m, run } = harness([" ", "f", "F", ...Array(7).fill("f"), 6]);
  await run();
  assert.deepEqual(messages(m).slice(0, 2), ["applied photo filter", "applied halftone filter"]);
  assert.equal(messages(m)[8], "applied poster filter");
  assert.equal(sends(m).at(-1), encode(renderPicture(fakeCells(1))));
});

test("d before capture only shows the hint", async () => {
  const { m, store, run } = harness(["d", "f", 6]);
  await run();
  assert.deepEqual(store.published, []);
  assert.deepEqual(messages(m), ["use keys at bottom of screen", "use keys at bottom of screen"]);
});

test("d publishes once per filter, shows the qr and returns to the picture on a key", async () => {
  const { m, store, renders, run } = harness([" ", "d", "x", "d", "x", "f", "d", "x", 6]);
  await run();
  const hash = hashOf(JPEG);
  assert.deepEqual(store.published, [`${hash}-poster.png`, `${hash}-poster.png`, `${hash}-photo.png`]);
  assert.equal(renders.length, 2, "poster rendered once, photo once");
  const prints = m.calls.filter((c) => c[0] === "print").map((c) => c[1]);
  assert.ok(prints.some((t) => /scan to download/.test(t)));
  assert.equal(sends(m).at(-1), encode(renderPicture(fakeCells(2))));
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

test("sommaire on the qr page leaves the page at once", async () => {
  const { m, run } = harness([" ", "d", 6]);
  const result = await Promise.race([run(), new Promise((r) => setTimeout(() => r("hung"), 500))]);
  assert.equal(result, 6, "the page kept waiting for a key after sommaire");
  const keys = m.calls.filter((c) => c[0] === "key").length;
  assert.equal(keys, 3, "no extra key read after sommaire");
  m.press(6);
});

test("a url too long for a qr falls back to text", async () => {
  const { m, run } = harness([" ", "d", "x", 6], { publicUrl: "https://a-very-long-hostname.example.com/with/a/long/path" });
  await run();
  const prints = m.calls.filter((c) => c[0] === "print").map((c) => c[1]);
  assert.ok(sends(m).some((s) => /open this address/.test(s)));
  assert.ok(!prints.some((t) => /scan to download/.test(t)));
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
