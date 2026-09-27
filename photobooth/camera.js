import { spawn as childSpawn } from "node:child_process";

const MAX_WIDTH = 1920;
const SKIP_FRAMES = 15;

// Parses "WxH" tokens from avfoundation's "Supported modes:" block or v4l2's -list_formats output.
export function parseModes(text) {
  const seen = new Set();
  const modes = [];
  for (const [, w, h] of text.matchAll(/(\d{2,5})x(\d{2,5})/g)) {
    const key = `${w}x${h}`;
    if (seen.has(key)) continue;
    seen.add(key);
    modes.push({ width: Number(w), height: Number(h) });
  }
  return modes;
}

// Largest 4:3 mode up to the cap, else the largest mode up to the cap, else null.
export function chooseMode(modes, { maxWidth = MAX_WIDTH } = {}) {
  const fitting = modes.filter((m) => m.width <= maxWidth);
  const byWidth = (a, b) => b.width - a.width;
  const fourThree = fitting.filter((m) => Math.abs(m.width / m.height - 4 / 3) < 0.01).sort(byWidth);
  if (fourThree.length) return fourThree[0];
  return fitting.sort(byWidth)[0] || null;
}

function inputArgs(platform, device) {
  return platform === "darwin"
    ? ["-f", "avfoundation", "-framerate", "30", "-pixel_format", "uyvy422"]
    : ["-f", "v4l2"];
}

export function probeArgs(platform, device) {
  return platform === "darwin"
    ? ["-hide_banner", "-f", "avfoundation", "-video_size", "1x1", "-i", device, "-frames:v", "1", "-f", "null", "-"]
    : ["-hide_banner", "-f", "v4l2", "-list_formats", "all", "-i", device];
}

export function captureArgs(platform, device, mode) {
  const size = mode ? ["-video_size", `${mode.width}x${mode.height}`] : [];
  return [
    "-hide_banner", "-loglevel", "error",
    ...inputArgs(platform, device),
    ...size,
    "-i", device,
    "-vf", `select=gte(n\\,${SKIP_FRAMES})`,
    "-fps_mode", "passthrough",
    "-frames:v", "1",
    "-q:v", "3",
    "-f", "image2pipe", "-vcodec", "mjpeg",
    "pipe:1",
  ];
}

export class Camera {
  constructor({ ffmpeg, device, platform = process.platform, spawn = childSpawn, timeoutMs = 15000 }) {
    this.ffmpeg = ffmpeg;
    this.device = device;
    this.platform = platform;
    this.spawn = spawn;
    this.timeoutMs = timeoutMs;
    this.mode = null;
    this.queue = Promise.resolve();
  }

  #run(args, { ignoreExit = false } = {}) {
    return new Promise((resolve, reject) => {
      const child = this.spawn(this.ffmpeg, args);
      const out = [];
      let err = "";
      let done = false;
      const finish = (fn, value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        fn(value);
      };
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish(reject, new Error(`ffmpeg timed out after ${this.timeoutMs} ms`));
      }, this.timeoutMs);
      child.stdout.on("data", (chunk) => out.push(chunk));
      child.stderr.on("data", (chunk) => { err += chunk.toString(); });
      child.on("error", (error) => finish(reject, error));
      child.on("close", (code) => {
        if (code !== 0 && !ignoreExit) {
          finish(reject, new Error(`ffmpeg exited with ${code}: ${err.trim().slice(-500)}`));
        } else {
          finish(resolve, { stdout: Buffer.concat(out), stderr: err });
        }
      });
    });
  }

  // Lists the device's modes and remembers the best one; rejects when ffmpeg cannot run.
  async probe() {
    const { stdout, stderr } = await this.#run(probeArgs(this.platform, this.device), { ignoreExit: true });
    this.mode = chooseMode(parseModes(stderr + stdout.toString()));
    return this.mode;
  }

  // One JPEG frame; concurrent calls run one after the other.
  capture() {
    const job = this.queue.then(async () => {
      const { stdout } = await this.#run(captureArgs(this.platform, this.device, this.mode));
      if (stdout.length === 0) throw new Error("ffmpeg produced no frame");
      return stdout;
    });
    this.queue = job.catch(() => {});
    return job;
  }
}
