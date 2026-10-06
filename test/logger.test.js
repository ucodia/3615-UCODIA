import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import logger, { localTimestamp, withLogContext, textLine, errorFields } from "../logger.js";
import { captureLogs } from "./log-capture.js";

const MESSAGE = Symbol.for("message");
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/;

function stampIn(tz, iso) {
  const code = `import { localTimestamp } from "./logger.js"; process.stdout.write(localTimestamp(new Date("${iso}")));`;
  return execFileSync(process.execPath, ["--input-type=module", "-e", code], { env: { ...process.env, TZ: tz } }).toString();
}

function captured(fn) {
  const capture = captureLogs();
  return Promise.resolve()
    .then(fn)
    .finally(() => capture.stop())
    .then(() => capture.lines);
}

test("localTimestamp writes local time with the offset of the zone", () => {
  assert.equal(stampIn("America/Vancouver", "2026-10-05T22:48:50.123Z"), "2026-10-05T15:48:50.123-07:00");
  assert.equal(stampIn("America/Vancouver", "2026-01-15T08:00:00.000Z"), "2026-01-15T00:00:00.000-08:00");
  assert.equal(stampIn("Asia/Kolkata", "2026-10-05T22:48:50.123Z"), "2026-10-06T04:18:50.123+05:30");
  assert.equal(stampIn("UTC", "2026-10-05T22:48:50.123Z"), "2026-10-05T22:48:50.123+00:00");
});

test("localTimestamp names the same instant", () => {
  const now = new Date();
  assert.match(localTimestamp(now), TS);
  assert.equal(Date.parse(localTimestamp(now)), now.getTime());
});

test("a line starts with ts, level and msg and leaves out null and undefined fields", async () => {
  const lines = await captured(() => logger.info("start", { url: "http://localhost:3615", commit: undefined, camera: null }));
  assert.equal(lines.length, 1);
  assert.deepEqual(Object.keys(lines[0]), ["ts", "level", "msg", "url"]);
  assert.match(lines[0].ts, TS);
  assert.equal(lines[0].level, "info");
  assert.equal(lines[0].msg, "start");
});

test("lines inside a context carry sid and client after msg, across awaits and timers", async () => {
  const lines = await captured(async () => {
    await withLogContext({ sid: "a3f09c", client: "minitel" }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      logger.info("page", { page: "photobooth" });
      await new Promise((resolve) => setTimeout(() => { logger.warn("marquee_failed", { error: "late" }); resolve(); }, 5));
    });
    logger.info("outside");
  });
  assert.deepEqual(Object.keys(lines[0]), ["ts", "level", "msg", "sid", "client", "page"]);
  assert.equal(lines[0].sid, "a3f09c");
  assert.equal(lines[1].client, "minitel");
  assert.equal(lines[2].msg, "outside");
  assert.equal(lines[2].sid, undefined);
  assert.equal(lines[2].client, undefined);
});

test("an explicit field wins over the context", async () => {
  const lines = await captured(() =>
    withLogContext({ sid: "aaaaaa", client: "minitel" }, () => logger.info("disconnect", { sid: "bbbbbb", seconds: 3 })),
  );
  assert.equal(lines[0].sid, "bbbbbb");
  assert.equal(lines[0].client, "minitel");
});

test("errorFields carries the message and the stack", () => {
  const fields = errorFields(new Error("boom"));
  assert.equal(fields.error, "boom");
  assert.match(fields.stack, /^Error: boom\n/);
  assert.deepEqual(errorFields("plain"), { error: "plain", stack: undefined });
});

test("the console line is text, with or without the timestamp", () => {
  const info = () => ({ level: "info", message: "page", timestamp: "2026-10-05T15:48:50.123-07:00", sid: "a3f09c", page: "two words", n: 2, view: undefined });
  assert.equal(textLine({ stamp: false }).transform(info())[MESSAGE], 'info page sid=a3f09c page="two words" n=2');
  assert.equal(textLine().transform(info())[MESSAGE], '2026-10-05T15:48:50.123-07:00 info page sid=a3f09c page="two words" n=2');
});
