import { test } from "node:test";
import assert from "node:assert/strict";
import { Minitel } from "../minitel.js";
import { captureLogs } from "./log-capture.js";

test("a screen file that cannot be read is logged and nothing is sent", async () => {
  const sent = [];
  const m = new Minitel({ send: async (data) => sent.push(data) });
  const capture = captureLogs();
  try {
    await m.xdraw("screens/missing.vdt");
  } finally {
    capture.stop();
  }
  assert.deepEqual(sent, []);
  assert.equal(capture.lines.length, 1);
  assert.equal(capture.lines[0].level, "warn");
  assert.equal(capture.lines[0].msg, "screen_load_failed");
  assert.equal(capture.lines[0].file, "screens/missing.vdt");
  assert.match(capture.lines[0].error, /ENOENT/);
});
