import winston from "winston";
import logger, { jsonLine } from "../logger.js";

const MESSAGE = Symbol.for("message");

class Capture extends winston.Transport {
  constructor(lines) {
    super({ format: jsonLine });
    this.lines = lines;
  }

  log(info, callback) {
    this.lines.push(JSON.parse(info[MESSAGE]));
    callback();
  }
}

// Collects every line the shared logger writes until stop().
export function captureLogs() {
  const lines = [];
  const transport = new Capture(lines);
  logger.add(transport);
  return { lines, stop: () => logger.remove(transport) };
}
