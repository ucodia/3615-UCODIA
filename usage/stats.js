import { readdir, readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

const LOG_FILE = /\.jsonl(\.gz)?$/;
const DAY_MS = 86400000;

export async function readLogs(dir, { warn = () => {} } = {}) {
  const names = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && LOG_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const records = [];
  for (const name of names) {
    let text;
    try {
      const raw = await readFile(join(dir, name));
      text = name.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
    } catch (error) {
      warn(`skipped ${name}: ${error.message}`);
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (typeof record.ts === "string" && typeof record.msg === "string" && !Number.isNaN(Date.parse(record.ts))) records.push(record);
      } catch {}
    }
  }
  return records;
}

const count = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
const ranked = (map) => [...map].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

// The menu order; a page name not listed here comes after them, by visits.
const MENU = ["exhibits", "workshops", "omelette", "venables", "photobooth"];

// With a client, keep its lines and every line that has no client (downloads, server errors).
export function forClient(records, client) {
  return client ? records.filter((r) => r.client === undefined || r.client === client) : records;
}

// A visit is the run of pages on one connection up to the next attract or disconnect;
// a run that never leaves the menu is not a visit.
export function summarize(records, { since = null } = {}) {
  const lines = records
    .filter((r) => !since || r.ts.slice(0, 10) >= since)
    .map((r, order) => ({ r, t: Date.parse(r.ts), order }))
    .sort((a, b) => a.t - b.t || a.order - b.order);

  const open = new Map();
  const runs = [];
  const published = new Map();
  const downloaded = new Set();
  const daily = new Map();
  let captures = 0;
  const day = (ts) => {
    const key = ts.slice(0, 10);
    if (!daily.has(key)) daily.set(key, { visits: 0, pictures: 0, downloaded: 0 });
    return daily.get(key);
  };
  const close = (sid) => {
    if (open.has(sid)) runs.push(open.get(sid));
    open.delete(sid);
  };

  for (const { r, t } of lines) {
    switch (r.msg) {
      case "attract":
      case "disconnect":
        close(r.sid);
        break;
      case "page": {
        if (!open.has(r.sid)) open.set(r.sid, { ts: r.ts, first: t, last: t, seen: new Map() });
        const run = open.get(r.sid);
        run.last = t;
        if (r.page === "welcome") break;
        if (!run.seen.has(r.page)) run.seen.set(r.page, new Map());
        const views = run.seen.get(r.page);
        if (!views.has(r.view ?? "")) views.set(r.view ?? "", new Set());
        if (r.n !== undefined) views.get(r.view ?? "").add(r.n);
        break;
      }
      case "capture":
        captures++;
        day(r.ts).pictures++;
        break;
      case "publish":
        published.set(`${r.hash}-${r.filter}`, r.filter);
        break;
      case "download": {
        const key = `${r.hash}-${r.filter}`;
        if (downloaded.has(key)) break;
        downloaded.add(key);
        day(r.ts).downloaded++;
        break;
      }
    }
  }
  for (const sid of [...open.keys()]) close(sid);

  const visits = runs.filter((v) => v.seen.size > 0);
  const lengths = visits.map((v) => v.last - v.first).sort((a, b) => a - b);
  const programs = new Map();
  for (const v of visits) {
    day(v.ts).visits++;
    for (const [name, views] of v.seen) {
      if (!programs.has(name)) programs.set(name, { name, visits: 0, views: new Map() });
      const program = programs.get(name);
      program.visits++;
      for (const [view, numbers] of views) {
        if (!program.views.has(view)) program.views.set(view, { view, visits: 0, numbers: new Map() });
        const reached = program.views.get(view);
        reached.visits++;
        for (const n of numbers) count(reached.numbers, n);
      }
    }
  }
  const place = (name) => (MENU.includes(name) ? MENU.indexOf(name) : MENU.length);
  const filters = new Map();
  for (const filter of published.values()) count(filters, filter);
  const from = lines[0]?.r.ts.slice(0, 10) ?? null;
  const to = lines.at(-1)?.r.ts.slice(0, 10) ?? null;

  return {
    from,
    to,
    days: from ? (Date.parse(to) - Date.parse(from)) / DAY_MS + 1 : 0,
    visits: visits.length,
    medianMs: lengths.length ? lengths[Math.floor((lengths.length - 1) / 2)] : 0,
    longestMs: lengths.at(-1) ?? 0,
    programs: [...programs.values()]
      .sort((a, b) => place(a.name) - place(b.name) || b.visits - a.visits || a.name.localeCompare(b.name))
      .map((p) => ({
        ...p,
        views: [...p.views.values()]
          .sort((a, b) => b.visits - a.visits || a.view.localeCompare(b.view))
          .map((v) => ({ ...v, numbers: [...v.numbers].sort((a, b) => a[0] - b[0]) })),
      })),
    photobooth: { captures, published: published.size, downloaded: downloaded.size, filters: ranked(filters) },
    daily: [...daily].sort((a, b) => a[0].localeCompare(b[0])),
  };
}

const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "-");
const per = (part, whole) => (whole ? (part / whole).toFixed(1) : "-");
const num = (n) => n.toLocaleString("en-US");
const visitsOf = (n) => `${num(n)} visit${n === 1 ? "" : "s"}`;

export function duration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m${String(s % 60).padStart(2, "0")}s` : `${m}m`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
}

export function formatReport(s, { emulatorVisits = 0 } = {}) {
  if (!s.from) return "no usage lines found";
  const p = s.photobooth;
  const out = [`3615 UCODIA  Minitel usage  ${s.from} → ${s.to}  (${s.days} day${s.days === 1 ? "" : "s"})`, ""];
  out.push(`${"Visits".padEnd(18)}${num(s.visits).padEnd(6)}about ${per(s.visits, s.days)} a day, typically ${duration(s.medianMs)}, longest ${duration(s.longestMs)}`);

  for (const program of s.programs) {
    out.push("", `${program.name.toUpperCase().padEnd(18)}${visitsOf(program.visits)} (${pct(program.visits, s.visits)})`);
    for (const { view, visits, numbers } of program.views) {
      const reached = numbers.map(([n, count]) => `${n}: ${pct(count, program.visits)}`).join("   ");
      if (view) out.push(`  ${view.padEnd(16)}${reached ? pct(visits, program.visits).padEnd(10) + reached : pct(visits, program.visits)}`);
      else if (reached) out.push(`  ${"pages".padEnd(16)}${reached}`);
    }
    if (program.name === "photobooth") {
      const looks = p.filters.map(([name, n]) => `${name} ${pct(n, p.published)}`).join("  ") || "-";
      out.push(`  ${"pictures taken".padEnd(16)}${num(p.captures).padEnd(6)}${per(p.captures, program.visits)} per visit`);
      out.push(`  ${"for download".padEnd(16)}${num(p.published).padEnd(6)}${pct(p.published, p.captures)} of pictures`);
      out.push(`  ${"downloaded".padEnd(16)}${num(p.downloaded).padEnd(6)}${pct(p.downloaded, p.published)} of those`);
      out.push(`  ${"looks".padEnd(16)}${looks}`);
    }
  }

  out.push("", `${"Emulator".padEnd(18)}${visitsOf(emulatorVisits)} on the website (not counted above)`, "");
  const columns = ["visits", "pictures", "downloaded"];
  out.push(["DAY".padEnd(12), ...columns.map((c) => c.padEnd(9))].join("").trimEnd());
  for (const [date, d] of s.daily) out.push([date.padEnd(12), ...columns.map((c) => String(d[c]).padEnd(9))].join("").trimEnd());
  return out.join("\n");
}
