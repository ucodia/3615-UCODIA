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

// A visit is the run of pages on one connection between a connect or an attract and the next
// attract or disconnect; a run that never leaves the menu is "menu only", except the menu a
// Minitel shows by itself when it connects.
export function summarize(records, { since = null } = {}) {
  const lines = records
    .filter((r) => !since || r.ts.slice(0, 10) >= since)
    .map((r, order) => ({ r, t: Date.parse(r.ts), order }))
    .sort((a, b) => a.t - b.t || a.order - b.order);

  const sessions = new Map();
  const visits = [];
  const publishes = new Map();
  const published = new Set();
  const downloads = new Map();
  const daily = new Map();
  const tally = {
    connections: new Map(), invalid: new Map(), entries: new Map(), captures: new Map(), published: new Map(),
    filters: new Map(), landings: new Map(), warnings: new Map(), missing: 0, errors: [],
  };
  const day = (ts) => {
    const key = ts.slice(0, 10);
    if (!daily.has(key)) daily.set(key, { visits: 0, captures: 0, published: 0, downloaded: 0, landings: 0 });
    return daily.get(key);
  };
  const session = (r) => {
    if (!sessions.has(r.sid)) sessions.set(r.sid, { client: r.client, opener: "log", visit: null });
    return sessions.get(r.sid);
  };
  const close = (s) => {
    if (s.visit) visits.push(s.visit);
    s.visit = null;
  };

  for (const { r, t } of lines) {
    if (r.level === "error") tally.errors.push(r);
    else if (r.level === "warn") count(tally.warnings, r.msg);

    switch (r.msg) {
      case "connect": {
        if (sessions.has(r.sid)) close(sessions.get(r.sid));
        sessions.set(r.sid, { client: r.client, opener: "connect", visit: null });
        count(tally.connections, r.client);
        break;
      }
      case "disconnect":
      case "attract": {
        const s = sessions.get(r.sid);
        if (!s) break;
        close(s);
        if (r.msg === "attract") s.opener = "attract";
        else sessions.delete(r.sid);
        break;
      }
      case "page": {
        const s = session(r);
        if (!s.visit) s.visit = { client: s.client, opener: s.opener, ts: r.ts, first: t, last: t, pages: 0, programs: new Set(), previous: null };
        const v = s.visit;
        v.last = t;
        if (!(r.page === "welcome" && v.previous !== null)) v.pages++;
        if (r.page !== "welcome") v.programs.add(r.page);
        if (r.page !== "welcome" && v.previous === "welcome") count(tally.entries, s.client);
        v.previous = r.page;
        break;
      }
      case "invalid_option":
        count(tally.invalid, r.client);
        count(tally.entries, r.client);
        break;
      case "capture":
        count(tally.captures, r.client);
        if (r.client === "minitel") day(r.ts).captures++;
        break;
      case "publish":
        publishes.set(r.hash, r.client);
        if (published.has(`${r.hash}-${r.filter}`)) break;
        published.add(`${r.hash}-${r.filter}`);
        count(tally.published, r.client);
        if (r.client === "minitel") {
          count(tally.filters, r.filter);
          day(r.ts).published++;
        }
        break;
      case "download": {
        const key = `${r.hash}-${r.filter}`;
        if (downloads.has(key)) break;
        downloads.set(key, publishes.get(r.hash) ?? null);
        day(r.ts).downloaded++;
        break;
      }
      case "download_missing":
        tally.missing++;
        break;
      case "landing":
        count(tally.landings, r.via);
        day(r.ts).landings++;
        break;
    }
  }
  for (const s of sessions.values()) close(s);

  const picked = (v) => v.programs.size > 0;
  const minitel = visits.filter((v) => v.client === "minitel" && picked(v));
  for (const v of minitel) day(v.ts).visits++;
  const lengths = minitel.map((v) => v.last - v.first).sort((a, b) => a - b);
  const programs = new Map();
  for (const v of minitel) for (const name of v.programs) count(programs, name);
  const downloadedBy = (client) => [...downloads.values()].filter((c) => c === client).length;
  const from = lines[0]?.r.ts.slice(0, 10) ?? null;
  const to = lines.at(-1)?.r.ts.slice(0, 10) ?? null;

  return {
    from,
    to,
    days: from ? (Date.parse(to) - Date.parse(from)) / DAY_MS + 1 : 0,
    minitel: {
      visits: minitel.length,
      menuOnly: visits.filter((v) => v.client === "minitel" && !picked(v) && v.opener !== "connect").length,
      pages: minitel.reduce((sum, v) => sum + v.pages, 0),
      medianMs: lengths.length ? lengths[Math.floor((lengths.length - 1) / 2)] : 0,
      longestMs: lengths.at(-1) ?? 0,
      invalid: tally.invalid.get("minitel") ?? 0,
      entries: tally.entries.get("minitel") ?? 0,
      programs: ranked(programs),
    },
    photobooth: {
      visits: programs.get("photobooth") ?? 0,
      captures: tally.captures.get("minitel") ?? 0,
      published: tally.published.get("minitel") ?? 0,
      downloaded: downloadedBy("minitel"),
      unattributed: downloadedBy(null),
      missing: tally.missing,
      filters: ranked(tally.filters),
    },
    emulator: {
      landings: { tunnel: tally.landings.get("tunnel") ?? 0, lan: tally.landings.get("lan") ?? 0 },
      connections: tally.connections.get("emulator") ?? 0,
      visits: visits.filter((v) => v.client === "emulator" && picked(v)).length,
      captures: tally.captures.get("emulator") ?? 0,
      downloaded: downloadedBy("emulator"),
    },
    errors: tally.errors,
    warnings: ranked(tally.warnings),
    daily: [...daily].sort((a, b) => a[0].localeCompare(b[0])),
  };
}

const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "-");
const per = (part, whole) => (whole ? (part / whole).toFixed(1) : "-");
const num = (n) => n.toLocaleString("en-US");

export function duration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m${String(s % 60).padStart(2, "0")}s` : `${m}m`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
}

const row = (label, value, note = "") => `  ${label.padEnd(18)}${String(value).padEnd(6)}${note ? `(${note})` : ""}`.trimEnd();

export function formatReport(s) {
  if (!s.from) return "no usage lines found";
  const { minitel: m, photobooth: p, emulator: e } = s;
  const out = [`3615 UCODIA usage  ${s.from} → ${s.to}  (${s.days} day${s.days === 1 ? "" : "s"})`, ""];

  out.push("MINITEL");
  out.push(row("visits", num(m.visits), `${per(m.visits, s.days)}/day, median ${duration(m.medianMs)}, longest ${duration(m.longestMs)}`));
  out.push(row("menu only", num(m.menuOnly), "woke it, picked nothing"));
  out.push(row("pages", num(m.pages), `${per(m.pages, m.visits)}/visit`));
  out.push(row("invalid options", num(m.invalid), `${pct(m.invalid, m.entries)} of menu entries`));
  out.push("");
  out.push(`  ${"program".padEnd(18)}${"visits".padEnd(9)}share`);
  for (const [name, n] of m.programs) out.push(`  ${name.padEnd(18)}${String(n).padEnd(9)}${pct(n, m.visits)}`);
  out.push("");

  out.push("PHOTOBOOTH (minitel)");
  out.push(row("captures", num(p.captures), `${per(p.captures, p.visits)}/photobooth visit`));
  out.push(row("published", num(p.published), `${pct(p.published, p.captures)} of captures`));
  out.push(row("downloaded", num(p.downloaded), `${pct(p.downloaded, p.published)} of published`));
  if (p.unattributed) out.push(row("unattributed", num(p.unattributed), "published before these logs"));
  out.push(row("missing links", num(p.missing)));
  const published = p.filters.reduce((sum, [, n]) => sum + n, 0);
  out.push(`  ${"filters".padEnd(18)}${p.filters.map(([name, n]) => `${name} ${pct(n, published)}`).join("  ") || "-"}`);
  out.push("");

  out.push("EMULATOR");
  out.push(row("landings", num(e.landings.tunnel + e.landings.lan), `tunnel ${e.landings.tunnel}, lan ${e.landings.lan}`));
  out.push(`  ${"connections".padEnd(18)}${String(e.connections).padEnd(6)}visits ${e.visits}   captures ${e.captures}   downloaded ${e.downloaded}`);
  out.push("");

  out.push("ERRORS");
  if (!s.errors.length && !s.warnings.length) out.push("  none");
  const shown = s.errors.slice(-10);
  const width = Math.max(18, ...shown.map((r) => r.msg.length + 2), ...s.warnings.map(([name]) => name.length + 2));
  for (const r of shown) out.push(`  ${r.msg.padEnd(width)}${r.ts.slice(0, 16).replace("T", " ")}  ${r.error ?? ""}`.trimEnd());
  if (s.errors.length > 10) out.push(`  … ${s.errors.length - 10} earlier errors`);
  for (const [name, n] of s.warnings) out.push(`  ${name.padEnd(width)}${n}`);
  out.push("");

  const columns = ["visits", "captures", "published", "downloaded", "landings"];
  out.push(["DAY".padEnd(12), ...columns.map((c) => c.padEnd(11))].join("").trimEnd());
  for (const [date, d] of s.daily) out.push([date.padEnd(12), ...columns.map((c) => String(d[c]).padEnd(11))].join("").trimEnd());
  return out.join("\n");
}
