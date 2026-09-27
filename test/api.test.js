import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import sharp from "sharp";
import { startServer } from "../server.js";

let server;
let wss;
let base;

before(async () => {
  ({ server, wss } = startServer(() => {}, 0));
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  wss.close();
  await new Promise((resolve) => server.close(resolve));
});

async function grey() {
  return sharp({ create: { width: 32, height: 24, channels: 3, background: "#808080" } }).png().toBuffer();
}

test("returns a videotex stream for an image", async () => {
  const res = await fetch(`${base}/api/vdt?cols=4&rows=2&preset=poster`, { method: "POST", body: await grey() });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/octet-stream");
  const body = Buffer.from(await res.arrayBuffer());
  assert.equal(res.headers.get("x-vdt-bytes"), String(body.length));
  assert.equal(body[0], 0x1f);
});

test("rejects bad options with 400", async () => {
  const res = await fetch(`${base}/api/vdt?cols=abc`, { method: "POST", body: await grey() });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /cols/);
});

test("rejects an empty body", async () => {
  const res = await fetch(`${base}/api/vdt`, { method: "POST" });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /image/i);
});

test("rejects a non-image body", async () => {
  const res = await fetch(`${base}/api/vdt?cols=2&rows=1`, { method: "POST", body: "hello" });
  assert.equal(res.status, 400);
});
