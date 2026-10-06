import { AsyncLocalStorage } from "node:async_hooks";
import winston from "winston";
import "winston-daily-rotate-file";

const { combine, timestamp, colorize, printf } = winston.format;
const context = new AsyncLocalStorage();

export function withLogContext(fields, fn) {
  return context.run(fields, fn);
}

export function errorFields(error) {
  return { error: error?.message ?? String(error), stack: error?.stack };
}

const pad = (n, width = 2) => String(n).padStart(width, "0");

export function localTimestamp(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
  return `${day}T${time}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const withContext = winston.format((info) => {
  for (const [key, value] of Object.entries(context.getStore() ?? {})) {
    if (info[key] === undefined) info[key] = value;
  }
  return info;
});

// sid and client first, then the line's own fields; null and undefined are left out
function fieldsOf(info) {
  const { level, message, timestamp: ts, sid, client, ...rest } = info;
  return Object.entries({ sid, client, ...rest }).filter(([, value]) => value !== undefined && value !== null);
}

export const jsonLine = printf((info) =>
  JSON.stringify({ ts: info.timestamp, level: info.level, msg: info.message, ...Object.fromEntries(fieldsOf(info)) }),
);

const quote = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /[\s"=]/.test(text) ? JSON.stringify(text) : text;
};

export const textLine = ({ stamp = true } = {}) =>
  printf((info) =>
    [stamp && info.timestamp, info.level, info.message, ...fieldsOf(info).map(([key, value]) => `${key}=${quote(value)}`)]
      .filter(Boolean)
      .join(" "),
  );

const logger = winston.createLogger({
  level: "info",
  format: combine(timestamp({ format: () => localTimestamp() }), withContext()),
  transports: [
    // journald stamps every line itself
    new winston.transports.Console({ format: combine(colorize(), textLine({ stamp: !process.env.JOURNAL_STREAM })) }),
    new winston.transports.DailyRotateFile({
      filename: "logs/%DATE%.jsonl",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      format: jsonLine,
    }),
  ],
});

export default logger;
