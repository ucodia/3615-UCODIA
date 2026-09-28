import { test } from "node:test";
import assert from "node:assert/strict";
import { Minitel, IdleError, ClosedError } from "../minitel.js";

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

test("one Minitel per socket: a second construction returns the same instance with one listener", () => {
  const ws = fakeSocket();
  let listeners = 0;
  const on = ws.on;
  ws.on = (event, fn) => { if (event === "message") listeners++; on(event, fn); };
  const a = new Minitel(ws);
  const b = new Minitel(ws);
  assert.equal(a, b);
  assert.equal(listeners, 1);
});

test("cancelRead reaches a read started through another construction on the same socket", async () => {
  const ws = fakeSocket();
  const welcome = new Minitel(ws);
  const page = new Minitel(ws);
  const pending = page.key();
  welcome.cancelRead(new IdleError());
  await assert.rejects(within(pending), IdleError);
});

test("a cancellation with nothing pending is latched and rejects the next read", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  m.cancelRead(new IdleError());
  await assert.rejects(within(m.key()), IdleError);
  const next = m.key();
  ws.deliver("b");
  assert.deepEqual(await within(next), ["b", 0], "the latch is consumed once");
});

test("close rejects the pending read and every later read with ClosedError", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const pending = m.key();
  m.close();
  await assert.rejects(within(pending), ClosedError);
  await assert.rejects(within(m.key()), ClosedError);
  assert.equal(m.closed, true);
});

test("a binary message that spells a key sequence is not read as a key", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const next = m.key();
  ws.deliver(Buffer.from("\x13F"));
  ws.deliver("b");
  assert.deepEqual(await within(next), ["b", 0]);
});

test("a binary message counts as activity", async () => {
  const ws = fakeSocket();
  const m = new Minitel(ws);
  const before = m.lastActivity;
  await new Promise((r) => setTimeout(r, 5));
  ws.deliver(Buffer.alloc(3));
  assert.ok(m.lastActivity > before);
});
