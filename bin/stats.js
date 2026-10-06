#!/usr/bin/env node
import { program } from "commander";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLogs, forClient, summarize, formatReport } from "../usage/stats.js";

program
  .name("stats")
  .description("Summarise Minitel usage, program by program, from the JSON Lines logs")
  .argument("[dir]", "log directory", join(dirname(fileURLToPath(import.meta.url)), "..", "logs"))
  .option("--since <date>", "first day to include, YYYY-MM-DD")
  .parse();

const opts = program.opts();
try {
  if (opts.since && !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) throw new Error("--since takes a date as YYYY-MM-DD");
  const since = opts.since ?? null;
  const records = await readLogs(program.processedArgs[0], { warn: (text) => console.error(text) });
  const emulatorVisits = summarize(forClient(records, "emulator"), { since }).visits;
  console.log(formatReport(summarize(forClient(records, "minitel"), { since }), { emulatorVisits }));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
