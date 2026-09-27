import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const run = promisify(execFile);

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "img2vdt-"));
  const file = join(dir, "grey.png");
  await writeFile(file, await sharp({ create: { width: 32, height: 24, channels: 3, background: "#c0c0c0" } }).png().toBuffer());
  return { dir, file };
}

test("cli writes the stream to stdout and reports on stderr", async () => {
  const { file } = await fixture();
  const { stdout, stderr } = await run("node", ["bin/img2vdt.js", file, "--cols", "4", "--rows", "2", "--preset", "poster"], { encoding: "latin1" });
  assert.equal(stdout.charCodeAt(0), 0x1f);
  assert.match(stderr, /\d+ bytes, [\d.]+ s at 4800 baud/);
});

test("cli writes to --out", async () => {
  const { dir, file } = await fixture();
  const out = join(dir, "grey.vdt");
  await run("node", ["bin/img2vdt.js", file, "--cols", "4", "--rows", "2", "--out", out]);
  const bytes = await readFile(out);
  assert.equal(bytes[0], 0x1f);
});

test("cli exits 1 on a bad option", async () => {
  const { file } = await fixture();
  await assert.rejects(run("node", ["bin/img2vdt.js", file, "--cols", "abc"]), (err) => {
    assert.equal(err.code, 1);
    assert.match(err.stderr, /cols/);
    return true;
  });
});
