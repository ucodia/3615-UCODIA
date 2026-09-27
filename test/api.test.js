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

test("serves the converter modules under /lib", async () => {
  for (const path of ["/lib/image/quantise.js", "/lib/image/field.js", "/lib/screen.js", "/lib/mosaic.js"]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type"), /javascript/, path);
  }
});

test("lib mount does not expose the repo root", async () => {
  for (const path of ["/lib/server.js", "/lib/package.json", "/lib/image/../server.js"]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 404, path);
  }
});

const viaTunnel = { headers: { "cf-connecting-ip": "203.0.113.7" } };

test("playground, lib and the conversion endpoint answer 404 through the tunnel", async () => {
  for (const path of ["/playground.html", "/lib/screen.js", "/lib/image/presets.js"]) {
    const res = await fetch(`${base}${path}`, viaTunnel);
    assert.equal(res.status, 404, path);
  }
  const post = await fetch(`${base}/api/vdt?cols=4&rows=2`, { ...viaTunnel, method: "POST", body: await grey() });
  assert.equal(post.status, 404);
});

test("the emulator and its library stay public through the tunnel", async () => {
  for (const path of ["/", "/library/minitel.js"]) {
    const res = await fetch(`${base}${path}`, viaTunnel);
    assert.equal(res.status, 200, path);
  }
});

test("playground, lib and the conversion endpoint serve locally", async () => {
  for (const path of ["/playground.html", "/lib/screen.js", "/lib/image/presets.js"]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 200, path);
  }
});
