import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import WebSocket from "ws";
import { selectProtocol, startServer } from "../server.js";

const TOKEN = "f".repeat(64);

test("selectProtocol picks the token and nothing else", () => {
  const select = selectProtocol(TOKEN);
  assert.equal(select(new Set([TOKEN])), TOKEN);
  assert.equal(select(new Set(["other", TOKEN])), TOKEN);
  assert.equal(select(new Set(["binary"])), false);
  assert.equal(select(new Set([TOKEN.slice(0, 63)])), false, "prefix");
  assert.equal(select(new Set([TOKEN + "0"])), false, "longer");
  assert.equal(select(new Set([TOKEN.toUpperCase()])), false, "case");
  assert.equal(select(new Set()), false);
});

test("selectProtocol without a token never selects", () => {
  assert.equal(selectProtocol(null)(new Set([TOKEN])), false);
});

async function withServer(terminalToken, fn) {
  const seen = [];
  const { server, wss } = startServer((ws, req, info) => seen.push({ protocol: ws.protocol, ...info }), 0, { terminalToken });
  await once(server, "listening");
  const url = `ws://127.0.0.1:${server.address().port}`;
  try {
    await fn(url, seen);
  } finally {
    wss.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function connect(url, protocols) {
  const ws = new WebSocket(url, protocols);
  const outcome = await once(ws, "open").then(() => "open", (error) => error.message);
  await new Promise((resolve) => setTimeout(resolve, 20));
  ws.terminate();
  return outcome;
}

test("a client offering the token is a terminal", async () => {
  await withServer(TOKEN, async (url, seen) => {
    assert.equal(await connect(url, TOKEN), "open");
    assert.deepEqual(seen, [{ protocol: TOKEN, terminal: true }]);
  });
});

test("a client offering no protocol or another protocol is public", async () => {
  await withServer(TOKEN, async (url, seen) => {
    assert.equal(await connect(url), "open");
    await connect(url, "binary");
    assert.deepEqual(seen.map((s) => s.terminal), [false, false]);
  });
});

test("a wrong token is public; the ws client drops such a handshake itself", async () => {
  await withServer(TOKEN, async (url, seen) => {
    const outcome = await connect(url, "e".repeat(64));
    assert.match(outcome, /subprotocol/i);
    assert.deepEqual(seen.map((s) => s.terminal), [false]);
  });
});

test("without a configured token everyone is public", async () => {
  await withServer(null, async (url, seen) => {
    await connect(url, TOKEN);
    assert.deepEqual(seen.map((s) => s.terminal), [false]);
  });
});

test("startupUrls uses the public url when given and localhost otherwise", async () => {
  const { startupUrls } = await import("../server.js");
  assert.deepEqual(startupUrls(3615), { emulator: "http://localhost:3615", websocket: "ws://localhost:3615" });
  assert.deepEqual(startupUrls(3615, "https://slice.example.com/"), { emulator: "https://slice.example.com", websocket: "wss://slice.example.com" });
  assert.deepEqual(startupUrls(3615, "http://minitelpi:3615"), { emulator: "http://minitelpi:3615", websocket: "ws://minitelpi:3615" });
});
