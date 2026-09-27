import { test } from "node:test";
import assert from "node:assert/strict";
import { programsFor } from "../slice/menu.js";

const programs = [
  { key: "1", title: "calendar" },
  { key: "P", title: "photobooth", terminalOnly: true },
];

test("programsFor keeps terminal-only entries for the terminal", () => {
  assert.deepEqual(programsFor(programs, { terminal: true }).map((p) => p.key), ["1", "P"]);
});

test("programsFor drops terminal-only entries for public connections", () => {
  assert.deepEqual(programsFor(programs, { terminal: false }).map((p) => p.key), ["1"]);
  assert.deepEqual(programsFor(programs, {}).map((p) => p.key), ["1"]);
});
