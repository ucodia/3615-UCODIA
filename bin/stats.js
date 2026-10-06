#!/usr/bin/env node
import { program } from "commander";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLogs, summarize, formatReport } from "../usage/stats.js";

program
  .name("stats")
  .description("Summarise Minitel and emulator usage from the JSON Lines logs")
  .argument("[dir]", "log directory", join(dirname(fileURLToPath(import.meta.url)), "..", "logs"))
  .option("--since <date>", "first day to include, YYYY-MM-DD")
  .parse();

const opts = program.opts();
try {
  if (opts.since && !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) throw new Error("--since takes a date as YYYY-MM-DD");
  const records = await readLogs(program.processedArgs[0], { warn: (text) => console.error(text) });
  console.log(formatReport(summarize(records, { since: opts.since ?? null })));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
