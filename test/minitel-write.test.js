import { test } from "node:test";
import assert from "node:assert/strict";
import { Minitel } from "../minitel.js";

function fakeSocket() {
  const ws = { sent: [], handlers: {}, onmessage: null };
  ws.send = async (data) => { ws.sent.push(data); };
  ws.on = (event, fn) => { ws.handlers[event] = fn; };
  ws.deliver = (data) => { ws.handlers.message?.(data); ws.onmessage?.({ data }); };
  return ws;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("a page's writes go out as one frame when the page waits for a key", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  await m.pos(1, 1);
  await m.print("hi");
  await m.inverse();
  const pending = m.key();
  await tick();
  assert.deepEqual(ws.sent, ["\x1ehi\x1b\x5d"]);
  ws.deliver("a");
  await pending;
});

test("writes with no read to follow go out on the next turn of the event loop", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  await m.print("a");
  await m.print("b");
  assert.deepEqual(ws.sent, []);
  await tick();
  assert.deepEqual(ws.sent, ["ab"]);
});

test("message() shows its text before it sleeps and erases it after", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const done = m.message(0, 1, 0.02, "hi");
  await tick();
  assert.deepEqual(ws.sent, ["\x1f\x40\x41hi"]);
  await done;
  await tick();
  assert.equal(ws.sent.length, 2);
  assert.equal(ws.sent[1], "\x1f\x40\x41  ");
});

test("a Buffer is sent as text, like a string", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  await m.send(Buffer.from("abc"));
  await tick();
  assert.deepEqual(ws.sent, ["abc"]);
});

test("a read that finds a key already buffered still flushes first", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const first = m.key();
  ws.deliver("ab");
  await first;
  await m.print("x");
  const [char] = await m.key();
  assert.equal(char, "b");
  assert.deepEqual(ws.sent, ["x"]);
});
