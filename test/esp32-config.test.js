import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv, websocketTarget, networksFrom, renderHeader } from "../bin/esp32-config.js";

const run = promisify(execFile);

test("parseEnv reads key=value lines, ignores comments and blanks, strips quotes and CR", () => {
  const env = parseEnv('# c\nA=1\r\nB="two words"\n\nC=x=y\n  D = spaced \n');
  assert.deepEqual(env, { A: "1", B: "two words", C: "x=y", D: "spaced" });
});

test("websocketTarget derives host, port and tls from PUBLIC_URL", () => {
  assert.deepEqual(websocketTarget("https://slice.example.com"), { host: "slice.example.com", port: 443, ssl: true });
  assert.deepEqual(websocketTarget("https://slice.example.com/"), { host: "slice.example.com", port: 443, ssl: true });
  assert.deepEqual(websocketTarget("http://minitelpi:3615"), { host: "minitelpi", port: 3615, ssl: false });
  assert.deepEqual(websocketTarget("http://minitelpi"), { host: "minitelpi", port: 3615, ssl: false });
  assert.throws(() => websocketTarget("minitelpi:3615"), /PUBLIC_URL/);
});

test("networksFrom collects numbered pairs in order and stops at the first gap", () => {
  const env = { WIFI_SSID_1: "a", WIFI_PASSWORD_1: "pa", WIFI_SSID_2: "b", WIFI_PASSWORD_2: "pb", WIFI_SSID_4: "d", WIFI_PASSWORD_4: "pd" };
  assert.deepEqual(networksFrom(env), [{ ssid: "a", password: "pa" }, { ssid: "b", password: "pb" }]);
  assert.deepEqual(networksFrom({ WIFI_SSID_1: "open" }), [{ ssid: "open", password: "" }]);
  assert.throws(() => networksFrom({}), /WIFI_SSID_1/);
});

test("renderHeader writes the defines and the networks array with escaping", () => {
  const header = renderHeader({
    PUBLIC_URL: "https://slice.example.com",
    TERMINAL_TOKEN: "t".repeat(40),
    WIFI_SSID_1: 'say "hi"',
    WIFI_PASSWORD_1: "back\\slash",
  });
  assert.match(header, /#define WS_HOST "slice\.example\.com"/);
  assert.match(header, /#define WS_PORT 443/);
  assert.match(header, /#define WS_SSL true/);
  assert.match(header, /#define WS_PATH "\/"/);
  assert.match(header, new RegExp(`#define WS_PROTOCOL "${"t".repeat(40)}"`));
  assert.match(header, /\{ "say \\"hi\\"", "back\\\\slash" \}/);
  assert.match(header, /const int networkCount = 1;/);
  assert.match(renderHeader({ PUBLIC_URL: "http://minitelpi:3615", WIFI_SSID_1: "x" }), /#define WS_PROTOCOL ""/, "no token means an empty protocol");
});

test("the script writes the header from .env and fails without PUBLIC_URL", async () => {
  const dir = await mkdtemp(join(tmpdir(), "esp32cfg-"));
  await writeFile(join(dir, ".env"), "PUBLIC_URL=https://slice.example.com\nWIFI_SSID_1=g\nWIFI_PASSWORD_1=p\n");
  const out = join(dir, "config.h");
  await run("node", ["bin/esp32-config.js", "--env", join(dir, ".env"), "--out", out]);
  assert.match(await readFile(out, "utf8"), /WS_HOST "slice\.example\.com"/);
  await writeFile(join(dir, ".env"), "WIFI_SSID_1=g\n");
  await assert.rejects(run("node", ["bin/esp32-config.js", "--env", join(dir, ".env"), "--out", out]), /PUBLIC_URL/);
});
