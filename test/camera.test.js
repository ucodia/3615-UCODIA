import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { parseModes, chooseMode, probeArgs, captureArgs, Camera } from "../photobooth/camera.js";
import { photoboothConfig } from "../photobooth/config.js";

// a fake ffmpeg child: script decides what it writes and how it exits
function fakeSpawn(script) {
  const calls = [];
  const spawn = (cmd, args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => { child.killed = true; };
    calls.push({ cmd, args, child });
    setImmediate(() => script(child, calls.length));
    return child;
  };
  return { spawn, calls };
}

test("parseModes reads avfoundation and v4l2 listings", () => {
  const mac = "[in#0 @ 0x1] Supported modes:\n[in#0 @ 0x1]   1920x1080@[15.000000 30.000000]fps\n[in#0 @ 0x1]   1760x1328@[15.000000 30.000000]fps\n";
  assert.deepEqual(parseModes(mac), [{ width: 1920, height: 1080 }, { width: 1760, height: 1328 }]);
  const linux = "[video4linux2,v4l2 @ 0x1] Compressed:       mjpeg :          Motion-JPEG : 640x480 1280x720 1920x1080\n";
  assert.deepEqual(parseModes(linux), [{ width: 640, height: 480 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]);
  assert.deepEqual(parseModes("nothing here"), []);
});

test("chooseMode prefers the largest 4:3 mode up to the cap", () => {
  const modes = [{ width: 3840, height: 2160 }, { width: 1920, height: 1080 }, { width: 1760, height: 1328 }, { width: 640, height: 480 }];
  assert.deepEqual(chooseMode(modes), { width: 1760, height: 1328 });
  assert.deepEqual(chooseMode([{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]), { width: 1920, height: 1080 });
  assert.deepEqual(chooseMode([{ width: 3840, height: 2160 }]), null);
  assert.equal(chooseMode([]), null);
});

test("captureArgs builds the platform command", () => {
  const mac = captureArgs("darwin", "FaceTime", { width: 1760, height: 1328 });
  assert.deepEqual(mac.slice(0, 8), ["-hide_banner", "-loglevel", "error", "-f", "avfoundation", "-framerate", "30", "-pixel_format"]);
  assert.ok(mac.includes("1760x1328") && mac.includes("FaceTime") && mac.includes("pipe:1"));
  const linux = captureArgs("linux", "/dev/video0", null);
  assert.ok(linux.includes("v4l2") && !linux.includes("-video_size") && linux.includes("/dev/video0"));
  assert.ok(probeArgs("darwin", "0").includes("1x1"));
  assert.ok(probeArgs("linux", "/dev/video0").includes("-list_formats"));
});

test("Camera.capture returns ffmpeg's stdout and queues concurrent calls", async () => {
  const order = [];
  const { spawn, calls } = fakeSpawn((child, n) => {
    order.push(`start${n}`);
    setTimeout(() => {
      child.stdout.end(Buffer.from(`jpeg${n}`));
      order.push(`end${n}`);
      child.emit("close", 0);
    }, n === 1 ? 30 : 5);
  });
  const camera = new Camera({ ffmpeg: "ffmpeg", device: "0", platform: "darwin", spawn });
  const [a, b] = await Promise.all([camera.capture(), camera.capture()]);
  assert.equal(a.toString(), "jpeg1");
  assert.equal(b.toString(), "jpeg2");
  assert.deepEqual(order, ["start1", "end1", "start2", "end2"]);
  assert.equal(calls[0].cmd, "ffmpeg");
});

test("Camera.capture rejects with stderr on a non-zero exit and on empty output", async () => {
  const { spawn } = fakeSpawn((child) => { child.stderr.end("Input/output error: no camera"); child.stdout.end(); child.emit("close", 1); });
  const camera = new Camera({ ffmpeg: "ffmpeg", device: "0", platform: "linux", spawn });
  await assert.rejects(camera.capture(), /no camera/);
  const empty = fakeSpawn((child) => { child.stdout.end(); child.emit("close", 0); });
  await assert.rejects(new Camera({ ffmpeg: "ffmpeg", device: "0", platform: "linux", spawn: empty.spawn }).capture(), /no frame/i);
});

test("Camera.capture rejects on timeout and kills the process", async () => {
  const { spawn, calls } = fakeSpawn(() => {});
  const camera = new Camera({ ffmpeg: "ffmpeg", device: "0", platform: "linux", spawn, timeoutMs: 20 });
  await assert.rejects(camera.capture(), /timed out/i);
  assert.equal(calls[0].child.killed, true);
});

test("Camera.probe picks a mode and rejects on spawn failure", async () => {
  const { spawn } = fakeSpawn((child) => { child.stderr.end("Supported modes:\n  1920x1080@[30.000000]fps\n  640x480@[30.000000]fps\n"); child.stdout.end(); child.emit("close", 1); });
  const camera = new Camera({ ffmpeg: "ffmpeg", device: "0", platform: "darwin", spawn });
  assert.deepEqual(await camera.probe(), { width: 640, height: 480 });
  assert.deepEqual(camera.mode, { width: 640, height: 480 });
  const broken = fakeSpawn((child) => child.emit("error", new Error("ENOENT")));
  await assert.rejects(new Camera({ ffmpeg: "nope", device: "0", platform: "darwin", spawn: broken.spawn }).probe(), /ENOENT/);
});

test("photoboothConfig defaults per platform and reads the environment", () => {
  const mac = photoboothConfig({}, "darwin");
  assert.equal(mac.device, "0");
  assert.equal(mac.publicUrl, "http://localhost:3615");
  assert.equal(mac.ttl, 300);
  assert.ok(mac.ffmpeg.endsWith("ffmpeg"));
  const linux = photoboothConfig({ PHOTOBOOTH_DEVICE: "/dev/video2", PHOTOBOOTH_FFMPEG: "/usr/bin/ffmpeg", PUBLIC_URL: "https://x.test/", PHOTOBOOTH_TTL: "20" }, "linux");
  assert.deepEqual(linux, { device: "/dev/video2", ffmpeg: "/usr/bin/ffmpeg", publicUrl: "https://x.test", ttl: 20 });
  assert.equal(photoboothConfig({}, "linux").device, "/dev/video0");
});
