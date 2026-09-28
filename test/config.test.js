import { test } from "node:test";
import assert from "node:assert/strict";
import { terminalToken, idleConfig } from "../config.js";

const TOKEN = "a".repeat(64);

test("terminalToken returns the token when it is long enough", () => {
  assert.equal(terminalToken({ TERMINAL_TOKEN: TOKEN }), TOKEN);
});

test("terminalToken trims whitespace, a carriage return and surrounding double quotes", () => {
  assert.equal(terminalToken({ TERMINAL_TOKEN: ` "${TOKEN}"\r` }), TOKEN);
});

test("terminalToken is null when unset, empty or shorter than 32 characters", () => {
  assert.equal(terminalToken({}), null);
  assert.equal(terminalToken({ TERMINAL_TOKEN: "" }), null);
  assert.equal(terminalToken({ TERMINAL_TOKEN: "x".repeat(31) }), null);
  assert.equal(terminalToken({ TERMINAL_TOKEN: "x".repeat(32) }), "x".repeat(32));
});

test("idleConfig defaults to 180 s idle and 30 s keep-alive and reads the environment", () => {
  assert.deepEqual(idleConfig({}), { idleMs: 180000, keepaliveMs: 30000 });
  assert.deepEqual(idleConfig({ IDLE_SECONDS: "60", KEEPALIVE_SECONDS: "0" }), { idleMs: 60000, keepaliveMs: 0 });
  assert.deepEqual(idleConfig({ IDLE_SECONDS: "abc", KEEPALIVE_SECONDS: "-3" }), { idleMs: 180000, keepaliveMs: 30000 });
});

test("idleConfig treats an empty value as unset and clamps to the timer maximum", () => {
  assert.deepEqual(idleConfig({ IDLE_SECONDS: "", KEEPALIVE_SECONDS: "" }), { idleMs: 180000, keepaliveMs: 30000 });
  assert.equal(idleConfig({ IDLE_SECONDS: "99999999" }).idleMs, 2147483000);
  assert.equal(idleConfig({ KEEPALIVE_SECONDS: "99999999" }).keepaliveMs, 2147483000);
});
