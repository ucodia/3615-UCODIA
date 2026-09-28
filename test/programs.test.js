import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrograms } from "../slice/programs.js";
import { programsFor } from "../slice/menu.js";

function fakeSocket() {
  const ws = { sent: [], handlers: {}, onmessage: null };
  ws.send = async (data) => { ws.sent.push(data); };
  ws.on = (event, fn) => { ws.handlers[event] = fn; };
  ws.deliver = (data) => { ws.handlers.message?.(data, false); ws.onmessage?.({ data }); };
  return ws;
}
const within = (promise, ms = 500) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("hung")), ms))]);
const config = { publicUrl: "https://slice.example.com", ttl: 300, gamma: 1 };
const store = { publish: async () => assert.fail("nothing is published in these tests") };

const FRAME = { data: Buffer.alloc(320 * 240 * 3, 128), raw: { width: 320, height: 240, channels: 3 } };
const countingCamera = () => { const c = { captures: 0, capture: async () => { c.captures++; return FRAME; } }; return c; };

async function visit(entry, ws, keys) {
  const page = entry.handoff(ws);
  for (const [delay, key] of keys) {
    await new Promise((r) => setTimeout(r, delay));
    ws.deliver(key);
  }
  return within(page, 6000);
}

test("public connections capture through a browser camera made for their socket, never the webcam", async () => {
  const webcam = countingCamera();
  const browser = countingCamera();
  const made = [];
  const makeBrowserCamera = (ws) => { made.push(ws); return browser; };
  const programs = programsFor(buildPrograms({ camera: webcam, store, config, makeBrowserCamera }), { terminal: false });
  const entries = programs.filter((p) => p.key === "P");
  assert.equal(entries.length, 1);
  const ws = fakeSocket();
  assert.equal(await visit(entries[0], ws, [[5, " "], [3600, "\x13F"]]), 6);
  assert.deepEqual(made, [ws]);
  assert.equal(browser.captures, 1);
  assert.equal(webcam.captures, 0);
});

test("the default browser camera is one per socket across visits", async () => {
  const programs = programsFor(buildPrograms({ camera: countingCamera(), store, config }), { terminal: false });
  const entry = programs.find((p) => p.key === "P");
  const ws = fakeSocket();
  let listeners = 0;
  const on = ws.on;
  ws.on = (event, fn) => { if (event === "message") listeners++; on(event, fn); };
  await visit(entry, ws, [[5, "\x13F"]]);
  await visit(entry, ws, [[5, "\x13F"]]);
  assert.equal(listeners, 2, "one Minitel listener and one camera listener");
});

test("the terminal captures through the webcam and no browser camera is ever made for it", async () => {
  const webcam = countingCamera();
  let made = 0;
  const programs = programsFor(buildPrograms({ camera: webcam, store, config, makeBrowserCamera: () => { made++; return countingCamera(); } }), { terminal: true });
  const entries = programs.filter((p) => p.key === "P");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].terminal, true);
  assert.equal(await visit(entries[0], fakeSocket(), [[5, " "], [3600, "\x13F"]]), 6);
  assert.equal(webcam.captures, 1);
  assert.equal(made, 0);
});

test("every audience sees the four shared entries", () => {
  for (const terminal of [true, false]) {
    const keys = programsFor(buildPrograms({ camera: countingCamera(), store, config }), { terminal }).map((p) => p.key);
    assert.deepEqual(keys, ["1", "2", "3", "V", "P"]);
  }
});
