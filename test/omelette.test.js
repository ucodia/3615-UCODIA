import { test } from "node:test";
import assert from "node:assert/strict";
import { displayOmeletteFacts, ageInYears } from "../slice/omelette.js";
import { captureLogs } from "./log-capture.js";

// A Minitel stand-in: records the screens drawn and feeds keys in order.
function fakeMinitel(keys) {
  const drawn = [];
  const m = {
    suite: "SUITE", droite: "DROITE", retour: "RETOUR", gauche: "GAUCHE", sommaire: "SOMMAIRE",
    jaune: 3, vert: 2, cyan: 6,
    drawn,
    async home() { drawn.push("HOME"); },
    async xdraw(file) { drawn.push(file); },
    async key() {
      const next = keys.shift();
      return typeof next === "string" && next.length === 1 ? [next, 0] : ["", next];
    },
  };
  for (const name of ["pos", "color", "backcolor", "plot", "printblock", "inverse", "message"]) m[name] = async () => {};
  m.printed = [];
  m.print = async (text) => { m.printed.push(text); };
  return m;
}

test("the facts page draws the face and gallery key 3 opens the first gallery screen", async () => {
  const m = fakeMinitel(["3", "SOMMAIRE", "SOMMAIRE"]);
  await displayOmeletteFacts(m);
  assert.deepEqual(m.drawn.slice(0, 3), ["HOME", "screens/omelette-face.vdt", "HOME"]);
  assert.equal(m.drawn[3], "screens/omelette-gallery-01.vdt");
});

test("suite and retour page through the four gallery screens and wrap", async () => {
  const m = fakeMinitel(["3", "SUITE", "SUITE", "SUITE", "SUITE", "RETOUR", "SOMMAIRE", "SOMMAIRE"]);
  await displayOmeletteFacts(m);
  const gallery = m.drawn.filter((f) => f.includes("gallery"));
  assert.deepEqual(gallery, [
    "screens/omelette-gallery-01.vdt", "screens/omelette-gallery-02.vdt", "screens/omelette-gallery-03.vdt",
    "screens/omelette-gallery-04.vdt", "screens/omelette-gallery-01.vdt", "screens/omelette-gallery-04.vdt",
  ]);
  // sommaire in the gallery returns to the facts page, whose face is drawn again
  assert.equal(m.drawn.filter((f) => f.endsWith("face.vdt")).length, 2);
});

test("3 and 1 page the gallery too, since SUITE and RETOUR are dead on the terminal", async () => {
  const m = fakeMinitel(["3", "3", "3", "1", "SOMMAIRE", "SOMMAIRE"]);
  await displayOmeletteFacts(m);
  const gallery = m.drawn.filter((f) => f.includes("gallery")).map((f) => f.slice(-6, -4));
  assert.deepEqual(gallery, ["01", "02", "03", "02"]);
});

test("every gallery screen shows prev 1, next 3 and back SOMMAIRE like the exhibits page", async () => {
  const m = fakeMinitel(["3", "3", "SOMMAIRE", "SOMMAIRE"]);
  await displayOmeletteFacts(m);
  const gallery = m.printed.slice(m.printed.indexOf("prev "));
  assert.equal(m.printed.filter((t) => t === "prev ").length, 2);
  assert.equal(m.printed.filter((t) => t === "next ").length, 2);
  assert.ok(gallery.includes(" 1 ") && gallery.includes(" 3 ") && gallery.includes("SOMMAIRE"));
  assert.ok(!m.printed.some((t) => /\d\/4/.test(t)));
});

test("sommaire on the facts page leaves and reports the key", async () => {
  const m = fakeMinitel(["SOMMAIRE"]);
  assert.equal(await displayOmeletteFacts(m), "SOMMAIRE");
});

test("age counts completed years, turning over on the birthday itself", () => {
  const birthdate = new Date(2018, 10, 1);
  assert.equal(ageInYears(birthdate, new Date(2026, 8, 29)), 7);
  assert.equal(ageInYears(birthdate, new Date(2026, 10, 1)), 8);
  assert.equal(ageInYears(birthdate, new Date(2026, 9, 31)), 7);
});

test("the facts page prints the computed age", async () => {
  const m = fakeMinitel(["SOMMAIRE"]);
  await displayOmeletteFacts(m);
  const age = m.printed.find((t) => t.startsWith("Age:"));
  assert.equal(age, `Age:   ${ageInYears(new Date(2018, 10, 1))} y.o.`);
});

test("the facts page and each gallery picture are logged as omelette pages", async () => {
  const capture = captureLogs();
  try {
    await displayOmeletteFacts(fakeMinitel(["3", "3", "SOMMAIRE", "SOMMAIRE"]));
  } finally {
    capture.stop();
  }
  assert.deepEqual(
    capture.lines.filter((l) => l.msg === "page").map(({ page, view, n }) => ({ page, view, n })),
    [
      { page: "omelette", view: "facts", n: undefined },
      { page: "omelette", view: "gallery", n: 1 },
      { page: "omelette", view: "gallery", n: 2 },
      { page: "omelette", view: "facts", n: undefined },
    ],
  );
});
