import { test } from "node:test";
import assert from "node:assert/strict";

test("the interactive module imports without starting anything", async () => {
  const mod = await import("../slice/venables.js");
  assert.equal(typeof mod.venablesVibes, "function");
});
