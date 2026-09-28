import { test } from "node:test";
import assert from "node:assert/strict";
import { startIdle, renderAttract, runAttract } from "../slice/attract.js";
import { encode } from "../screen.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stub() {
  const m = { lastActivity: Date.now(), sent: [], pending: null, queue: [] };
  m.send = async (data) => { m.sent.push(data); };
  m.home = async () => { m.sent.push("home"); };
  m.cls = async () => { m.sent.push("cls"); };
  m.key = () => new Promise((resolve) => { m.pending = resolve; });
  m.press = (char) => { const r = m.pending; m.pending = null; if (r) r([char, 0]); };
  return m;
}

test("startIdle fires after idleMs of silence and not before", async () => {
  const m = stub();
  let fired = 0;
  const idle = startIdle(m, { idleMs: 40, keepaliveMs: 0, onIdle: () => fired++ });
  await sleep(20);
  assert.equal(fired, 0);
  await sleep(40);
  assert.equal(fired, 1);
  idle.stop();
});

test("activity in between postpones the idle timer", async () => {
  const m = stub();
  let fired = 0;
  const idle = startIdle(m, { idleMs: 40, keepaliveMs: 0, onIdle: () => fired++ });
  await sleep(25);
  m.lastActivity = Date.now();
  await sleep(25);
  assert.equal(fired, 0, "the countdown restarted from the activity");
  await sleep(40);
  assert.equal(fired, 1);
  idle.stop();
});

test("keep-alive sends the byte at its interval and stop cancels everything", async () => {
  const m = stub();
  const idle = startIdle(m, { idleMs: 1000, keepaliveMs: 15, onIdle: () => {} });
  await sleep(50);
  const beats = m.sent.filter((s) => s === "\x00").length;
  assert.ok(beats >= 2 && beats <= 4, `beats ${beats}`);
  idle.stop();
  const after = m.sent.length;
  await sleep(40);
  assert.equal(m.sent.length, after, "nothing after stop");
});

test("keepaliveMs 0 disables the keep-alive only", async () => {
  const m = stub();
  let fired = 0;
  const idle = startIdle(m, { idleMs: 20, keepaliveMs: 0, onIdle: () => fired++ });
  await sleep(50);
  assert.equal(m.sent.length, 0);
  assert.equal(fired, 1);
  idle.stop();
});

test("renderAttract moves between steps and always says press any key", () => {
  const a = encode(renderAttract(0));
  const b = encode(renderAttract(1));
  assert.notEqual(Buffer.from(a).toString("latin1"), Buffer.from(b).toString("latin1"));
  for (const step of [0, 1, 2, 3, 4]) {
    const text = Buffer.from(encode(renderAttract(step))).toString("latin1");
    assert.match(text, /press any key/);
    assert.match(text, /3615 SLICE/);
  }
  assert.equal(Buffer.from(encode(renderAttract(5))).toString("latin1"), Buffer.from(encode(renderAttract(0))).toString("latin1"), "the path wraps");
});

test("runAttract redraws on each timeout and returns on a key without another frame", async () => {
  const m = stub();
  const done = runAttract(m, { frameMs: 20 });
  await sleep(55);
  const frames = m.sent.filter((s) => s !== "home" && s !== "cls").length;
  assert.ok(frames >= 3, `frames ${frames}`);
  m.press("x");
  await Promise.race([done, sleep(200).then(() => { throw new Error("hung"); })]);
  const after = m.sent.length;
  await sleep(50);
  assert.equal(m.sent.length, after, "no frame after the key");
});
