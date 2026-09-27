import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const NAME = /^[0-9a-f]{7}-[a-z]+\.png$/;

// Published renders live in one directory and expire ttlMs after their last publish.
export class PhotoStore {
  constructor({ dir, ttlMs, now = Date.now }) {
    this.dir = dir;
    this.ttlMs = ttlMs;
    this.now = now;
    this.expires = new Map();
  }

  static validName(name) {
    return NAME.test(name);
  }

  #path(name) {
    return join(this.dir, name);
  }

  async purge() {
    this.expires.clear();
    await rm(this.dir, { recursive: true, force: true });
    await mkdir(this.dir, { recursive: true });
  }

  async publish(name, png) {
    if (!PhotoStore.validName(name)) throw new Error(`Invalid photo name ${name}`);
    const path = this.#path(name);
    const created = !(await this.#exists(path));
    if (created) {
      await mkdir(this.dir, { recursive: true });
      await writeFile(path, png);
    }
    this.expires.set(name, this.now() + this.ttlMs);
    return { path, created };
  }

  async get(name) {
    if (!PhotoStore.validName(name) || !this.expires.has(name)) return null;
    if (this.expires.get(name) <= this.now()) {
      await this.#forget(name);
      return null;
    }
    return this.#path(name);
  }

  async sweep() {
    let deleted = 0;
    for (const [name, expires] of this.expires) {
      if (expires <= this.now()) {
        await this.#forget(name);
        deleted++;
      }
    }
    return deleted;
  }

  async #forget(name) {
    this.expires.delete(name);
    await rm(this.#path(name), { force: true });
  }

  async #exists(path) {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

