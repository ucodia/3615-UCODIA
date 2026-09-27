import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PhotoStore } from "../photobooth/store.js";

async function makeStore(ttlMs = 1000) {
  const dir = join(await mkdtemp(join(tmpdir(), "photostore-")), "photos");
  let clock = 1_000_000;
  const store = new PhotoStore({ dir, ttlMs, now: () => clock });
  return { store, dir, tick: (ms) => { clock += ms; } };
}
const PNG = Buffer.from("not really a png");

test("validName accepts hash-filter.png only", () => {
  assert.equal(PhotoStore.validName("0123abcd-poster.png"), true);
  for (const bad of ["../x.png", "abc.png", "0123abcd-Poster.png", "0123abcd-poster.jpg", "0123abcd-poster.png/..", "0123ABCD-poster.png", ""]) {
    assert.equal(PhotoStore.validName(bad), false, bad);
  }
});

test("publish writes once and re-publish only refreshes expiry", async () => {
  const { store, dir, tick } = await makeStore(1000);
  const first = await store.publish("0123abcd-poster.png", PNG);
  assert.equal(first.created, true);
  const before = (await stat(first.path)).mtimeMs;
  tick(800);
  await new Promise((r) => setTimeout(r, 20));
  const second = await store.publish("0123abcd-poster.png", Buffer.from("different"));
  assert.equal(second.created, false);
  assert.equal((await stat(second.path)).mtimeMs, before);
  tick(500);
  assert.equal(await store.get("0123abcd-poster.png"), first.path, "still valid after refresh");
  assert.deepEqual(await readdir(dir), ["0123abcd-poster.png"]);
});

test("get returns null for unknown, invalid and expired names, deleting expired files", async () => {
  const { store, dir, tick } = await makeStore(1000);
  assert.equal(await store.get("ffffffff-photo.png"), null);
  assert.equal(await store.get("../etc/passwd"), null);
  const { path } = await store.publish("0123abcd-poster.png", PNG);
  assert.equal(await store.get("0123abcd-poster.png"), path);
  tick(1001);
  assert.equal(await store.get("0123abcd-poster.png"), null);
  assert.deepEqual(await readdir(dir), []);
});

test("sweep deletes only expired entries and purge empties the directory", async () => {
  const { store, dir, tick } = await makeStore(1000);
  await store.publish("aaaaaaaa-poster.png", PNG);
  tick(600);
  await store.publish("bbbbbbbb-photo.png", PNG);
  tick(500);
  assert.equal(await store.sweep(), 1);
  assert.deepEqual(await readdir(dir), ["bbbbbbbb-photo.png"]);
  await writeFile(join(dir, "stray.png"), PNG);
  await store.purge();
  assert.deepEqual(await readdir(dir), []);
  assert.equal(await store.get("bbbbbbbb-photo.png"), null);
});

test("get with an invalid name never touches a missing directory", async () => {
  const store = new PhotoStore({ dir: join(tmpdir(), "does-not-exist-" + Date.now()), ttlMs: 1000 });
  assert.equal(await store.get("../../x"), null);
  assert.equal(await store.sweep(), 0);
});
