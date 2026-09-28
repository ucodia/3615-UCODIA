import { test } from "node:test";
import assert from "node:assert/strict";
import { BrowserCamera, CAMERA_ON, CAPTURE, CAMERA_OFF } from "../photobooth/browser-camera.js";

const FRAME = 320 * 240 * 3;

function fakeSocket() {
  const ws = { sent: [], handlers: {} };
  ws.send = (data) => { ws.sent.push(Buffer.from(data)); };
  ws.on = (event, fn) => { ws.handlers[event] = fn; };
  ws.deliver = (data, isBinary = true) => { ws.handlers.message?.(data, isBinary); };
  return ws;
}
const bytes = (ws) => ws.sent.map((b) => Array.from(b));

test("open and close send their control byte", () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  camera.open();
  camera.close();
  assert.deepEqual(bytes(ws), [[CAMERA_ON], [CAMERA_OFF]]);
});

test("capture sends the capture byte and resolves with a tagged frame", async () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  const pending = camera.capture();
  assert.deepEqual(bytes(ws), [[CAPTURE]]);
  ws.deliver(Buffer.alloc(FRAME, 7));
  const frame = await pending;
  assert.equal(frame.data.length, FRAME);
  assert.equal(frame.data[0], 7);
  assert.deepEqual(frame.raw, { width: 320, height: 240, channels: 3 });
});

test("an empty message means no camera", async () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  const pending = camera.capture();
  ws.deliver(Buffer.alloc(0));
  await assert.rejects(pending, /no camera/);
});

test("a frame of the wrong length is refused", async () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  const pending = camera.capture();
  ws.deliver(Buffer.alloc(FRAME - 1));
  await assert.rejects(pending, /bad frame/);
});

test("capture times out", async () => {
  const camera = new BrowserCamera({ websocket: fakeSocket(), timeoutMs: 20 });
  await assert.rejects(camera.capture(), /camera timeout/);
});

test("text during a capture is ignored, a frame with no capture pending is dropped", async () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  ws.deliver(Buffer.alloc(FRAME));
  const pending = camera.capture();
  ws.deliver("x", false);
  let settled = false;
  pending.then(() => { settled = true; }, () => { settled = true; });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(settled, false);
  ws.deliver(Buffer.alloc(FRAME));
  await pending;
});

test("one capture at a time, and the next one works after an outcome", async () => {
  const ws = fakeSocket();
  const camera = new BrowserCamera({ websocket: ws });
  const first = camera.capture();
  await assert.rejects(camera.capture(), /in progress/);
  ws.deliver(Buffer.alloc(0));
  await assert.rejects(first, /no camera/);
  const second = camera.capture();
  ws.deliver(Buffer.alloc(FRAME));
  await second;
});
