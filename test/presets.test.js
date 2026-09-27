import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, preset } from "../image/presets.js";

test("the five looks exist with the documented settings", () => {
  assert.deepEqual(Object.keys(PRESETS), ["photo", "poster", "halftone", "newsprint", "stencil", "stripes", "sketch", "typewriter"]);
  assert.equal(preset("photo").method, "diffuse");
  assert.equal(preset("photo").toneWeight, 2);
  assert.equal(preset("poster").method, "flat");
  assert.equal(preset("halftone").method, "bayer");
  assert.equal(preset("newsprint").method, "noise");
  assert.deepEqual([...preset("newsprint").palette], [0, 7]);
  assert.deepEqual([...preset("stencil").palette], [0, 4, 7]);
  assert.equal(preset("stripes").method, "dot");
  assert.deepEqual([...preset("stripes").palette], [0, 7]);
  assert.equal(preset("sketch").filter, "edges");
  assert.equal(preset("sketch").method, "flat");
  assert.equal(preset("typewriter").method, "text");
  for (const p of Object.values(PRESETS)) assert.ok(["none", "edges"].includes(p.filter));
});

test("unknown preset throws", () => {
  assert.throws(() => preset("sepia"), /Unknown preset/);
});
