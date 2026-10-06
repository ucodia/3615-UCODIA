import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { readLogs, forClient, summarize, formatReport, duration } from "../usage/stats.js";

const L = (at, msg, fields = {}) => ({ ts: `2026-10-${at}-07:00`, level: "info", msg, ...fields });
const M = { client: "minitel", sid: "m00001" };
const E = { client: "emulator", sid: "e00001" };
const page = (at, name, fields = {}, who = M) => L(at, "page", { ...who, page: name, ...fields });

const LOG = [
  L("06T09:00:00.000", "connect", M),
  page("06T09:00:00.100", "welcome"),
  L("06T09:03:00.100", "attract", M),

  page("06T10:00:00.000", "welcome"),
  page("06T10:00:10.000", "exhibits", { n: 1 }),
  page("06T10:00:20.000", "exhibits", { n: 2 }),
  page("06T10:00:30.000", "welcome"),
  page("06T10:00:40.000", "omelette", { view: "facts" }),
  page("06T10:00:50.000", "omelette", { view: "gallery", n: 1 }),
  page("06T10:01:00.000", "omelette", { view: "gallery", n: 2 }),
  page("06T10:01:10.000", "omelette", { view: "facts" }),
  page("06T10:01:20.000", "welcome"),
  L("06T10:04:20.000", "attract", M),

  page("06T11:00:00.000", "welcome"),
  page("06T11:00:05.000", "photobooth"),
  L("06T11:00:20.000", "capture", { ...M, hash: "aaaaaaa" }),
  L("06T11:00:30.000", "publish", { ...M, hash: "aaaaaaa", filter: "poster" }),
  L("06T11:00:35.000", "download", { hash: "aaaaaaa", filter: "poster" }),
  L("06T11:00:36.000", "download", { hash: "aaaaaaa", filter: "poster" }),
  L("06T11:00:40.000", "publish", { ...M, hash: "aaaaaaa", filter: "poster" }),
  L("06T11:01:00.000", "capture", { ...M, hash: "bbbbbbb" }),
  L("06T11:01:10.000", "publish", { ...M, hash: "bbbbbbb", filter: "photo" }),
  L("06T11:01:15.000", "download", { hash: "bbbbbbb", filter: "photo" }),
  page("06T11:01:30.000", "welcome"),
  page("06T11:01:40.000", "exhibits", { n: 1 }),
  L("06T11:04:40.000", "attract", M),

  page("07T12:00:00.000", "welcome"),
  page("07T12:00:05.000", "venables", { view: "map", n: 2 }),
  page("07T12:00:15.000", "venables", { view: "qr" }),
  page("07T12:00:25.000", "venables", { view: "map", n: 2 }),
  page("07T12:00:35.000", "venables", { view: "map", n: 3 }),
  L("07T12:01:00.000", "disconnect", { ...M, seconds: 97260 }),

  L("07T09:00:00.000", "download", { hash: "ccccccc", filter: "half" }),
  L("07T09:30:00.000", "landing", { client: "emulator", via: "tunnel" }),
  L("07T09:30:01.000", "connect", E),
  page("07T09:30:01.100", "welcome", {}, E),
  page("07T09:30:09.000", "omelette", { view: "facts" }, E),
  L("07T09:30:20.000", "capture", { ...E, hash: "eeeeeee" }),
  L("07T09:31:00.000", "disconnect", { ...E, seconds: 59 }),
];

const minitel = () => summarize(forClient(LOG, "minitel"));

test("visits split at attract and disconnect; a run that never leaves the menu is not a visit", () => {
  const s = minitel();
  assert.equal(s.visits, 3);
  assert.equal(s.medianMs, 80000, "first page to last page, not to the attract");
  assert.equal(s.longestMs, 100000);
  assert.equal(s.days, 2);
});

test("each program counts its visits and how many of them reached each view and number", () => {
  assert.deepEqual(minitel().programs, [
    { name: "exhibits", visits: 2, views: [{ view: "", visits: 2, numbers: [[1, 2], [2, 1]] }] },
    { name: "omelette", visits: 1, views: [{ view: "facts", visits: 1, numbers: [] }, { view: "gallery", visits: 1, numbers: [[1, 1], [2, 1]] }] },
    { name: "venables", visits: 1, views: [{ view: "map", visits: 1, numbers: [[2, 1], [3, 1]] }, { view: "qr", visits: 1, numbers: [] }] },
    { name: "photobooth", visits: 1, views: [{ view: "", visits: 1, numbers: [] }] },
  ]);
});

test("programs follow the menu order and a page name not on the menu comes after, by visits", () => {
  const s = summarize([
    page("08T10:00:00.000", "photobooth"),
    L("08T10:01:00.000", "attract", M),
    page("08T10:02:00.000", "arcade"),
    L("08T10:03:00.000", "attract", M),
    page("08T10:04:00.000", "workshops", { n: 1 }),
  ]);
  assert.deepEqual(s.programs.map((p) => p.name), ["workshops", "photobooth", "arcade"]);
});

test("the photobooth counts pictures, distinct publishes and distinct downloads, whoever made them", () => {
  assert.deepEqual(minitel().photobooth, { captures: 2, published: 2, downloaded: 3, filters: [["photo", 1], ["poster", 1]] });
});

test("the emulator is kept apart: its visits and captures are not in the Minitel numbers", () => {
  const emulator = summarize(forClient(LOG, "emulator"));
  assert.equal(emulator.visits, 1);
  assert.equal(minitel().photobooth.captures, 2);
  assert.ok(!minitel().programs.find((p) => p.name === "omelette").views.some((v) => v.visits > 1));
});

test("the day table counts Minitel visits, pictures and downloads per day", () => {
  assert.deepEqual(minitel().daily, [
    ["2026-10-06", { visits: 2, pictures: 2, downloaded: 2 }],
    ["2026-10-07", { visits: 1, pictures: 0, downloaded: 1 }],
  ]);
});

test("pages of a connection whose connect is not in the logs still make a visit", () => {
  const s = summarize([page("08T10:00:00.000", "welcome"), page("08T10:00:30.000", "venables", { view: "map", n: 1 })]);
  assert.equal(s.visits, 1);
  assert.equal(s.medianMs, 30000);
});

test("--since keeps that day and later, and the range follows", () => {
  const s = summarize(forClient(LOG, "minitel"), { since: "2026-10-07" });
  assert.equal(s.from, "2026-10-07");
  assert.equal(s.days, 1);
  assert.equal(s.visits, 1);
  assert.deepEqual(s.programs.map((p) => p.name), ["venables"]);
});

test("lines are ordered by instant, across the fall-back hour and in any input order", () => {
  const s = summarize([
    { ts: "2026-11-01T01:10:00.000-08:00", level: "info", msg: "page", ...M, page: "exhibits", n: 1 },
    { ts: "2026-11-01T01:30:00.000-07:00", level: "info", msg: "page", ...M, page: "welcome" },
  ]);
  assert.equal(s.visits, 1);
  assert.equal(s.medianMs, 40 * 60 * 1000);
  assert.deepEqual(summarize([...LOG].reverse()), summarize(LOG));
});

test("readLogs reads .jsonl and .jsonl.gz, and skips subfolders, other files, broken lines and broken archives", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stats-"));
  const line = (r) => JSON.stringify(r);
  await writeFile(join(dir, "2026-10-06.jsonl.gz"), gzipSync([line(LOG[0]), line(LOG[1])].join("\n") + "\n"));
  await writeFile(join(dir, "2026-10-07.jsonl"), [line(LOG[33]), "not json", '{"msg":"no ts"}', ""].join("\n"));
  await writeFile(join(dir, "2026-10-05.jsonl.gz"), Buffer.from("not gzip"));
  await writeFile(join(dir, "2026-09-30-application.log"), "2026-09-30T08:57:38.972Z [info]: Navigating to welcome page\n");
  await mkdir(join(dir, "archive"));
  await writeFile(join(dir, "archive", "2026-09-29.jsonl"), line(LOG[2]));
  const warnings = [];
  const records = await readLogs(dir, { warn: (text) => warnings.push(text) });
  assert.deepEqual(records.map((r) => r.msg), ["connect", "page", "landing"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /2026-10-05\.jsonl\.gz/);
});

test("the report has the visits line, a section per program, the emulator line and the day table", () => {
  const report = formatReport(minitel(), { emulatorVisits: 1 });
  const expected = [
    "3615 UCODIA  Minitel usage  2026-10-06 → 2026-10-07  (2 days)",
    "Visits            3     about 1.5 a day, typically 1m20s, longest 1m40s",
    "EXHIBITS          2 visits (67%)",
    "  pages           1: 100%   2: 50%",
    "OMELETTE          1 visit (33%)",
    "  facts           100%",
    "  gallery         100%      1: 100%   2: 100%",
    "VENABLES          1 visit (33%)",
    "  map             100%      2: 100%   3: 100%",
    "  qr              100%",
    "PHOTOBOOTH        1 visit (33%)",
    "  pictures taken  2     2.0 per visit",
    "  for download    2     100% of pictures",
    "  downloaded      3     150% of those",
    "  looks           photo 50%  poster 50%",
    "Emulator          1 visit on the website (not counted above)",
    "DAY         visits   pictures downloaded",
    "2026-10-06  2        2        2",
  ];
  const lines = report.split("\n");
  for (const line of expected) assert.ok(lines.includes(line), `missing: ${JSON.stringify(line)}`);
  assert.ok(lines.indexOf("EXHIBITS          2 visits (67%)") < lines.indexOf("OMELETTE          1 visit (33%)"));
  assert.ok(!report.includes("WORKSHOPS"), "a program nobody opened has no section");
  assert.ok(!lines.some((l) => l.startsWith("  pages") && l.includes("PHOTOBOOTH")));
  assert.equal(formatReport(summarize([])), "no usage lines found");
});

test("duration reads as seconds, minutes or hours", () => {
  assert.equal(duration(45000), "45s");
  assert.equal(duration(100000), "1m40s");
  assert.equal(duration(840000), "14m");
  assert.equal(duration(7380000), "2h03m");
});

test("the command reports a folder, counts emulator visits apart and rejects a malformed --since", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stats-cli-"));
  await writeFile(join(dir, "2026-10-06.jsonl"), LOG.map((r) => JSON.stringify(r)).join("\n"));
  const out = execFileSync(process.execPath, ["bin/stats.js", dir]).toString();
  assert.match(out, /^3615 UCODIA  Minitel usage/);
  assert.match(out, /^Visits {12}3 /m);
  assert.match(out, /^Emulator {10}1 visit on the website/m);
  const bad = spawnSync(process.execPath, ["bin/stats.js", dir, "--since", "yesterday"]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr.toString(), /YYYY-MM-DD/);
});
