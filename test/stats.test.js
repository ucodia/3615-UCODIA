import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { readLogs, summarize, formatReport, duration } from "../usage/stats.js";

const L = (at, msg, fields = {}) => ({ ts: `2026-10-${at}-07:00`, level: "info", msg, ...fields });
const M = { client: "minitel", sid: "m00001" };
const E = { client: "emulator", sid: "e00001" };

const DAY = [
  L("06T10:00:00.000", "connect", M),
  L("06T10:00:00.100", "page", { ...M, page: "welcome" }),
  L("06T10:03:00.100", "attract", M),
  L("06T11:00:00.000", "page", { ...M, page: "welcome" }),
  L("06T11:00:05.000", "invalid_option", { ...M, key: "9" }),
  L("06T11:00:10.000", "page", { ...M, page: "photobooth" }),
  L("06T11:00:20.000", "capture", { ...M, hash: "aaaaaaa" }),
  L("06T11:00:30.000", "publish", { ...M, hash: "aaaaaaa", filter: "poster" }),
  L("06T11:00:40.000", "download", { hash: "aaaaaaa", filter: "poster" }),
  L("06T11:00:41.000", "download", { hash: "aaaaaaa", filter: "poster" }),
  L("06T11:01:00.000", "page", { ...M, page: "welcome" }),
  L("06T11:01:40.000", "page", { ...M, page: "exhibits", n: 1 }),
  L("06T11:04:40.000", "attract", M),
  L("06T12:00:00.000", "page", { ...M, page: "welcome" }),
  L("06T12:03:00.000", "attract", M),
  L("07T09:00:00.000", "download", { hash: "bbbbbbb", filter: "photo" }),
  L("07T09:00:01.000", "download_missing", { name: "ccccccc-half.png" }),
  L("07T09:30:00.000", "landing", { via: "tunnel" }),
  L("07T09:30:01.000", "connect", E),
  L("07T09:30:01.100", "page", { ...E, page: "welcome" }),
  L("07T09:30:09.000", "page", { ...E, page: "omelette", view: "facts" }),
  L("07T09:31:00.000", "disconnect", { ...E, seconds: 59 }),
  L("07T09:40:00.000", "page_error", { ...M, level: "error", error: "boom" }),
  L("07T09:41:00.000", "capture_failed", { ...M, level: "warn", error: "camera timeout" }),
];

test("visits split at attract; the menu right after a Minitel connect is neither a visit nor menu only", () => {
  const { minitel } = summarize(DAY);
  assert.equal(minitel.visits, 1);
  assert.equal(minitel.menuOnly, 1);
  assert.equal(minitel.medianMs, 100000, "first page to last page, not to the attract");
  assert.equal(minitel.longestMs, 100000);
});

test("a return to the menu is neither a page nor a pick; invalid options are menu entries", () => {
  const { minitel } = summarize(DAY);
  assert.equal(minitel.pages, 3);
  assert.equal(minitel.invalid, 1);
  assert.equal(minitel.entries, 3);
  assert.deepEqual(minitel.programs, [["exhibits", 1], ["photobooth", 1]]);
});

test("downloads count once per hash and filter; a hash never published is unattributed", () => {
  const { photobooth } = summarize(DAY);
  assert.deepEqual(
    { ...photobooth, filters: undefined },
    { visits: 1, captures: 1, published: 1, downloaded: 1, unattributed: 1, missing: 1, filters: undefined },
  );
  assert.deepEqual(photobooth.filters, [["poster", 1]]);
});

test("the emulator is counted apart from the Minitel", () => {
  const { emulator } = summarize(DAY);
  assert.deepEqual(emulator, { landings: { tunnel: 1, lan: 0 }, connections: 1, visits: 1, captures: 0, downloaded: 0 });
});

test("errors are kept and warnings counted by name", () => {
  const s = summarize(DAY);
  assert.deepEqual(s.errors.map((r) => r.error), ["boom"]);
  assert.deepEqual(s.warnings, [["capture_failed", 1]]);
});

test("pages of a connection whose connect is not in the logs still make a visit", () => {
  const s = summarize([
    L("08T10:00:00.000", "page", { ...M, page: "welcome" }),
    L("08T10:00:30.000", "page", { ...M, page: "venables", view: "map", n: 1 }),
  ]);
  assert.equal(s.minitel.visits, 1);
  assert.equal(s.minitel.medianMs, 30000);
});

test("--since keeps that day and later, and the range follows", () => {
  const s = summarize(DAY, { since: "2026-10-07" });
  assert.equal(s.from, "2026-10-07");
  assert.equal(s.days, 1);
  assert.equal(s.minitel.visits, 0);
  assert.equal(s.emulator.visits, 1);
});

test("lines are ordered by instant, across the fall-back hour and in any input order", () => {
  const fallBack = [
    { ts: "2026-11-01T01:10:00.000-08:00", level: "info", msg: "page", ...M, page: "exhibits", n: 1 },
    { ts: "2026-11-01T01:30:00.000-07:00", level: "info", msg: "page", ...M, page: "welcome" },
  ];
  const s = summarize(fallBack);
  assert.equal(s.minitel.visits, 1);
  assert.equal(s.minitel.pages, 2);
  assert.equal(s.minitel.medianMs, 40 * 60 * 1000);
  assert.deepEqual(summarize([...DAY].reverse()), summarize(DAY));
});

test("readLogs reads .jsonl and .jsonl.gz, and skips subfolders, other files, broken lines and broken archives", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stats-"));
  const line = (r) => JSON.stringify(r);
  await writeFile(join(dir, "2026-10-06.jsonl.gz"), gzipSync([line(DAY[0]), line(DAY[1])].join("\n") + "\n"));
  await writeFile(join(dir, "2026-10-07.jsonl"), [line(DAY[17]), "not json", '{"msg":"no ts"}', ""].join("\n"));
  await writeFile(join(dir, "2026-10-05.jsonl.gz"), Buffer.from("not gzip"));
  await writeFile(join(dir, "2026-09-30-application.log"), "2026-09-30T08:57:38.972Z [info]: Navigating to welcome page\n");
  await mkdir(join(dir, "archive"));
  await writeFile(join(dir, "archive", "2026-09-29.jsonl"), line(DAY[2]));
  const warnings = [];
  const records = await readLogs(dir, { warn: (text) => warnings.push(text) });
  assert.deepEqual(records.map((r) => r.msg), ["connect", "page", "landing"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /2026-10-05\.jsonl\.gz/);
});

test("the report shows every section and the daily table", () => {
  const report = formatReport(summarize(DAY));
  for (const part of ["3615 UCODIA usage  2026-10-06 → 2026-10-07  (2 days)", "MINITEL", "PHOTOBOOTH (minitel)", "EMULATOR", "ERRORS"]) {
    assert.ok(report.includes(part), part);
  }
  assert.match(report, /visits {12}1 {5}\(0\.5\/day, median 1m40s, longest 1m40s\)/);
  assert.match(report, /filters {11}poster 100%/);
  assert.match(report, /missing links {5}1$/m);
  assert.match(report, /page_error {8}2026-10-07 09:40 {2}boom/);
  assert.match(report, /^2026-10-06 {2}1 /m);
  assert.equal(formatReport(summarize([])), "no usage lines found");
});

test("duration reads as seconds, minutes or hours", () => {
  assert.equal(duration(45000), "45s");
  assert.equal(duration(100000), "1m40s");
  assert.equal(duration(840000), "14m");
  assert.equal(duration(7380000), "2h03m");
});

test("the command reports a directory and rejects a malformed --since", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stats-cli-"));
  await writeFile(join(dir, "2026-10-06.jsonl"), DAY.map((r) => JSON.stringify(r)).join("\n"));
  const out = execFileSync(process.execPath, ["bin/stats.js", dir, "--since", "2026-10-06"]).toString();
  assert.match(out, /^3615 UCODIA usage/);
  const bad = spawnSync(process.execPath, ["bin/stats.js", dir, "--since", "yesterday"]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr.toString(), /YYYY-MM-DD/);
});

test("a warning or error name longer than the label column keeps a space before its value", () => {
  const report = formatReport(summarize([
    L("08T10:00:00.000", "subprotocol_rejected", { level: "warn", ip: "203.0.113.9" }),
    L("08T10:00:01.000", "local_only_refused", { level: "warn", path: "/playground.html", ip: "203.0.113.9" }),
    L("08T10:00:02.000", "store_sweep_failed", { level: "error", error: "disk gone" }),
  ]));
  assert.match(report, /subprotocol_rejected +1$/m);
  assert.match(report, /local_only_refused +1$/m);
  assert.match(report, /store_sweep_failed +2026-10-08 10:00  disk gone$/m);
});

test("publishing the same picture and filter twice counts once", () => {
  const { photobooth } = summarize([
    L("08T10:00:00.000", "capture", { ...M, hash: "ddddddd" }),
    L("08T10:00:10.000", "publish", { ...M, hash: "ddddddd", filter: "poster" }),
    L("08T10:01:10.000", "publish", { ...M, hash: "ddddddd", filter: "poster" }),
    L("08T10:01:20.000", "publish", { ...M, hash: "ddddddd", filter: "photo" }),
  ]);
  assert.equal(photobooth.published, 2);
  assert.deepEqual(photobooth.filters, [["photo", 1], ["poster", 1]]);
});
