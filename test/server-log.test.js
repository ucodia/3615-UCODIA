import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import logger from "../logger.js";
import { startServer } from "../server.js";
import { PhotoStore } from "../photobooth/store.js";
import { captureLogs } from "./log-capture.js";

const TOKEN = "f".repeat(64);
let server, wss, base, store;
let handler = async () => {};

before(async () => {
  store = new PhotoStore({ dir: join(await mkdtemp(join(tmpdir(), "serverlog-")), "photos"), ttlMs: 60000 });
  ({ server, wss } = startServer((ws, req, info) => handler(ws, req, info), 0, { photoStore: store, terminalToken: TOKEN, sweepMs: 100000 }));
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  wss.close();
  await new Promise((resolve) => server.close(resolve));
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

async function captured(fn) {
  const capture = captureLogs();
  try {
    await fn();
    await settle();
  } finally {
    capture.stop();
  }
  return capture.lines;
}

async function openSocket(protocols) {
  const ws = new WebSocket(base.replace(/^http/, "ws"), protocols);
  await once(ws, "open");
  return ws;
}

test("connect and disconnect name the client and share one sid", async () => {
  handler = async () => {};
  const lines = await captured(async () => {
    for (const protocols of [TOKEN, undefined]) {
      const ws = await openSocket(protocols);
      ws.close();
      await once(ws, "close");
      await settle();
    }
  });
  const connects = lines.filter((l) => l.msg === "connect");
  const disconnects = lines.filter((l) => l.msg === "disconnect");
  assert.deepEqual(connects.map((l) => l.client), ["minitel", "emulator"]);
  assert.equal(disconnects.length, 2);
  for (const [i, c] of connects.entries()) {
    assert.match(c.sid, /^[0-9a-f]{6}$/);
    assert.equal(disconnects[i].sid, c.sid);
    assert.equal(disconnects[i].client, c.client);
    assert.equal(typeof disconnects[i].seconds, "number");
  }
  assert.notEqual(connects[0].sid, connects[1].sid);
  assert.ok(lines.every((l) => l.ip === undefined), "no ip on connection lines");
});

test("lines written by the page handler carry the connection's sid and client", async () => {
  handler = async (ws) => {
    await once(ws, "message");
    logger.info("page", { page: "welcome" });
  };
  const lines = await captured(async () => {
    const ws = await openSocket();
    ws.send("x");
    await settle();
    ws.close();
  });
  const connect = lines.find((l) => l.msg === "connect");
  const page = lines.find((l) => l.msg === "page");
  assert.equal(page.sid, connect.sid);
  assert.equal(page.client, "emulator");
});

test("a page error is logged with its stack, even when thrown synchronously", async () => {
  for (const thrower of [async () => { throw new Error("boom"); }, () => { throw new Error("sync boom"); }]) {
    handler = thrower;
    const lines = await captured(async () => {
      const ws = await openSocket();
      await once(ws, "close");
    });
    const connect = lines.find((l) => l.msg === "connect");
    const error = lines.find((l) => l.msg === "page_error");
    assert.equal(error.level, "error");
    assert.equal(error.sid, connect.sid);
    assert.match(error.error, /boom/);
    assert.match(error.stack, /Error: (sync )?boom/);
  }
});

test("GET / is a landing through the tunnel or on the lan; HEAD is not", async () => {
  const lines = await captured(async () => {
    await fetch(`${base}/`);
    await fetch(`${base}/`, { headers: { "cf-connecting-ip": "203.0.113.9" } });
    await fetch(`${base}/`, { method: "HEAD" });
  });
  assert.deepEqual(lines.filter((l) => l.msg === "landing").map((l) => l.via), ["lan", "tunnel"]);
  assert.ok(lines.every((l) => l.ip === undefined), "no ip on landings");
});

test("page files, the icons and unknown paths write nothing at info", async () => {
  const lines = await captured(async () => {
    assert.equal((await fetch(`${base}/favicon.ico`)).status, 200);
    assert.equal((await fetch(`${base}/apple-touch-icon.png`)).status, 200);
    await fetch(`${base}/css/minitel-keyboard.css`);
    await fetch(`${base}/library/minitel.js`);
    assert.equal((await fetch(`${base}/wp-admin/setup.php`)).status, 404);
  });
  assert.deepEqual(lines, []);
});

test("a local-only path through the tunnel is refused with its path and ip", async () => {
  const lines = await captured(() => fetch(`${base}/playground.html`, { headers: { "cf-connecting-ip": "203.0.113.9" } }));
  assert.deepEqual(
    lines.map(({ level, msg, path, ip }) => ({ level, msg, path, ip })),
    [{ level: "warn", msg: "local_only_refused", path: "/playground.html", ip: "203.0.113.9" }],
  );
});

test("a served photo is a download with hash and filter, each time it is fetched", async () => {
  await store.publish("0123abc-poster.png", Buffer.from("png"));
  const lines = await captured(async () => {
    assert.equal((await fetch(`${base}/p/0123abc-poster.png`)).status, 200);
    assert.equal((await fetch(`${base}/p/0123abc-poster.png`)).status, 200);
  });
  assert.deepEqual(
    lines.map(({ msg, hash, filter }) => ({ msg, hash, filter })),
    [{ msg: "download", hash: "0123abc", filter: "poster" }, { msg: "download", hash: "0123abc", filter: "poster" }],
  );
});

test("every photo link with no picture behind it is download_missing, its name cut to 200 characters", async () => {
  const huge = `0123abc-${"z".repeat(5000)}.png`;
  const lines = await captured(async () => {
    for (const name of ["fffffff-photo.png", "abc.png", "0123abc-zzz.png", huge]) {
      assert.equal((await fetch(`${base}/p/${name}`)).status, 404, name);
    }
  });
  assert.deepEqual(lines.map(({ msg, name }) => ({ msg, name })), [
    { msg: "download_missing", name: "fffffff-photo.png" },
    { msg: "download_missing", name: "abc.png" },
    { msg: "download_missing", name: "0123abc-zzz.png" },
    { msg: "download_missing", name: huge.slice(0, 200) },
  ]);
});

test("a refused local-only path is cut to 200 characters", async () => {
  const lines = await captured(() => fetch(`${base}/lib/${"x".repeat(5000)}`, { headers: { "cf-connecting-ip": "203.0.113.9" } }));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].msg, "local_only_refused");
  assert.ok(lines[0].path.length <= 200, `path of ${lines[0].path.length} characters`);
});
