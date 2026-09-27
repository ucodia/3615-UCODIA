import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { startServer } from "../server.js";
import { PhotoStore } from "../photobooth/store.js";

let server, wss, base, store;
let clock = 5_000_000;

before(async () => {
  const dir = join(await mkdtemp(join(tmpdir(), "photoroute-")), "photos");
  store = new PhotoStore({ dir, ttlMs: 1000, now: () => clock });
  ({ server, wss } = startServer(() => {}, 0, { photoStore: store, sweepMs: 20 }));
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  wss.close();
  await new Promise((resolve) => server.close(resolve));
});

test("serves a published photo as image/png", async () => {
  const png = await sharp({ create: { width: 8, height: 10, channels: 3, background: "#808080" } }).png().toBuffer();
  await store.publish("0123abc-poster.png", png);
  const res = await fetch(`${base}/p/0123abc-poster.png`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /image\/png/);
  assert.equal((await res.arrayBuffer()).byteLength, png.length);
});

test("unknown, malformed and expired names are 404", async () => {
  for (const name of ["fffffff-photo.png", "abc.png", "..%2Fserver.js", "0123abc-poster.png%2F..%2F..%2Fpackage.json"]) {
    const res = await fetch(`${base}/p/${name}`);
    assert.equal(res.status, 404, name);
  }
  clock += 1001;
  const res = await fetch(`${base}/p/0123abc-poster.png`);
  assert.equal(res.status, 404);
});

test("the sweeper removes expired entries in the background", async () => {
  const png = Buffer.from("x");
  await store.publish("abcdef0-photo.png", png);
  clock += 2000;
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(store.expires.has("abcdef0-photo.png"), false);
});

test("a store error answers 404 instead of hanging", async () => {
  const broken = { get: async () => { throw new Error("disk gone"); }, sweep: async () => 0 };
  const { server: s2, wss: w2 } = startServer(() => {}, 0, { photoStore: broken, sweepMs: 100000 });
  await once(s2, "listening");
  try {
    const res = await fetch(`http://127.0.0.1:${s2.address().port}/p/0123abc-poster.png`, { signal: AbortSignal.timeout(1000) });
    assert.equal(res.status, 404);
  } finally {
    w2.close();
    s2.closeAllConnections();
    await new Promise((resolve) => s2.close(resolve));
  }
});
