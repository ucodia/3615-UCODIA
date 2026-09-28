import { test } from "node:test";
import assert from "node:assert/strict";
import { Minitel, IdleError } from "../minitel.js";

function fakeSocket() {
  const ws = { sent: [], handlers: {}, onmessage: null };
  ws.send = async (data) => { ws.sent.push(data); };
  ws.on = (event, fn) => { ws.handlers[event] = fn; };
  ws.deliver = (data) => { ws.handlers.message?.(data); ws.onmessage?.({ data }); };
  return ws;
}

const within = (promise, ms = 300) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("hung")), ms))]);

test("lastActivity is stamped on every message, even when nothing is reading", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const before = m.lastActivity;
  await new Promise((r) => setTimeout(r, 5));
  ws.deliver("x");
  assert.ok(m.lastActivity > before);
});

test("cancelRead rejects a pending key read with the given error and later reads work", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const pending = m.key();
  m.cancelRead(new IdleError());
  await assert.rejects(within(pending), IdleError);
  const next = m.key();
  ws.deliver("a");
  assert.deepEqual(await within(next), ["a", 0]);
});

test("cancelRead with nothing pending is a no-op", () => {
  const m = new Minitel(fakeSocket());
  m.cancelRead(new IdleError());
});

test("input propagates the cancellation", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const pending = m.input(23, 2, 1, "", " ", false, true);
  await new Promise((r) => setTimeout(r, 5));
  m.cancelRead(new IdleError());
  await assert.rejects(within(pending), IdleError);
});
