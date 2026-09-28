import { test } from "node:test";
import assert from "node:assert/strict";
import { programsFor } from "../slice/menu.js";

const programs = [
  { key: "1", title: "calendar" },
  { key: "P", title: "photobooth", terminal: true, camera: "webcam" },
  { key: "P", title: "photobooth", terminal: false, camera: "browser" },
];

test("programsFor gives the terminal its photobooth and the shared entries", () => {
  const list = programsFor(programs, { terminal: true });
  assert.deepEqual(list.map((p) => p.key), ["1", "P"]);
  assert.equal(list[1].camera, "webcam");
});

test("programsFor gives public connections the browser photobooth and the shared entries", () => {
  for (const options of [{ terminal: false }, {}]) {
    const list = programsFor(programs, options);
    assert.deepEqual(list.map((p) => p.key), ["1", "P"]);
    assert.equal(list[1].camera, "browser");
  }
});
