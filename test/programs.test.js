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
const webcam = { capture: async () => assert.fail("webcam reached from a public connection") };
const store = { publish: async () => assert.fail("nothing is published in these tests") };

test("public connections get a photobooth built on a browser camera for their socket", async () => {
  const made = [];
  const makeBrowserCamera = (ws) => { made.push(ws); return { capture: async () => assert.fail("no capture here") }; };
  const programs = programsFor(buildPrograms({ camera: webcam, store, config, makeBrowserCamera }), { terminal: false });
  const entries = programs.filter((p) => p.key === "P");
  assert.equal(entries.length, 1);
  const ws = fakeSocket();
  const page = entries[0].handoff(ws);
  await new Promise((r) => setTimeout(r, 5));
  ws.deliver("\x13F");
  assert.equal(await within(page), 6);
  assert.deepEqual(made, [ws]);
});

test("the terminal gets one photobooth and no browser camera is ever made for it", () => {
  const programs = programsFor(buildPrograms({ camera: webcam, store, config, makeBrowserCamera: () => assert.fail("browser camera for the terminal") }), { terminal: true });
  const entries = programs.filter((p) => p.key === "P");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].terminal, true);
});

test("every audience sees the four shared entries", () => {
  for (const terminal of [true, false]) {
    const keys = programsFor(buildPrograms({ camera: webcam, store, config }), { terminal }).map((p) => p.key);
    assert.deepEqual(keys, ["1", "2", "3", "V", "P"]);
  }
});
