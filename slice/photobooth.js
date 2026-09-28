import { createHash } from "node:crypto";
import { Minitel } from "../minitel.js";
import logger from "../logger.js";
import { encode } from "../screen.js";
import { prepare } from "../image/prepare.js";
import { cellSize, applyFilter, toCells } from "../image/pipeline.js";
import { PRESETS } from "../image/presets.js";
import { renderPng } from "../image/render.js";
import {
  FILTERS,
  FILTER_CODES,
  renderIdle,
  renderCountdown,
  renderSmile,
  renderPicture,
  renderQr,
  renderUrl,
} from "./photobooth-screens.js";

const COLS = 40;
const NOTE_COL = 15; // right of the menu hint; the terminal owns columns 39 and 40 of row 0
const NOTE_WIDTH = 23;
const VERT = 2;
const CYAN = 6;
const BLANC = 7;
const ROWS = 24;
const COUNTDOWN_MS = 1000;

export function hashOf(source) {
  return createHash("sha256").update(source.data ?? source).digest("hex").slice(0, 7);
}

// Every look at once, mirrored like a mirror, with one prepare per cell size.
export async function convertAll(jpeg, { gamma = 1 } = {}) {
  const fields = new Map();
  const cells = new Map();
  for (const name of FILTERS) {
    const preset = PRESETS[name];
    const cell = cellSize(preset.method);
    const key = cell.join("x");
    if (!fields.has(key)) fields.set(key, await prepare(jpeg, COLS, ROWS, { cell, mirror: true, gamma }));
    cells.set(name, toCells(applyFilter(fields.get(key), preset.filter), preset));
  }
  return cells;
}

export function createPhotobooth({
  camera,
  store,
  publicUrl,
  makeMinitel = (websocket) => new Minitel(websocket),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  render = renderPng,
  gamma = 1,
  convert = (jpeg) => convertAll(jpeg, { gamma }),
  dump = null,
  log = logger,
  ttl = 300,
  qrTimeoutMs = 60000,
}) {
  const caption = `scan to download - expires in ${Math.max(1, Math.round(ttl / 60))} min`;
  return async function photobooth(websocket) {
    const m = makeMinitel(websocket);
    let shot = null;
    let index = 0;
    let lastKey = 0;

    let erase = null;
    // the status row: the way back to the menu on the left, notifications on the right
    const hint = async () => {
      await m.pos(0, 1);
      await m.color(CYAN);
      await m.inverse();
      await m.print("SOMMAIRE");
      await m.inverse(0);
      await m.color(VERT);
      await m.print(" menu");
      await m.color(BLANC);
    };
    const show = async (screen, { menuHint = true } = {}) => {
      clearTimeout(erase);
      await m.home();
      await m.cls();
      if (menuHint) await hint();
      await m.send(encode(screen));
    };
    const showPicture = () => show(renderPicture(shot.cells.get(FILTERS[index])));
    // erased by a timer so keys keep being read while it shows
    const notify = async (text, seconds = 2) => {
      clearTimeout(erase);
      await m.pos(0, NOTE_COL);
      await m.inverse();
      await m.print(text.padEnd(NOTE_WIDTH));
      await m.inverse(0);
      erase = setTimeout(() => {
        m.pos(0, NOTE_COL).then(() => m.plot(" ", NOTE_WIDTH)).catch(() => {});
      }, seconds * 1000);
    };

    async function capture() {
      for (const digit of [3, 2, 1]) {
        await show(renderCountdown(digit));
        await sleep(COUNTDOWN_MS);
      }
      await show(renderSmile());
      try {
        const jpeg = await camera.capture();
        const hash = hashOf(jpeg);
        if (dump) await dump(jpeg, hash).catch((error) => log.warn(`Photobooth: dump failed: ${error.message}`));
        shot = { hash, cells: await convert(jpeg), pngs: new Map() };
        index = 0;
        log.info(`Photobooth: captured ${shot.hash}`);
        await showPicture();
      } catch (error) {
        log.warn(`Photobooth: capture failed: ${error.message}`);
        await show(renderIdle());
        await notify("camera not available", 3);
      }
    }

    async function download() {
      const filter = FILTERS[index];
      const name = `${shot.hash}-${FILTER_CODES[filter]}.png`;
      try {
        if (!shot.pngs.has(filter)) shot.pngs.set(filter, await render(shot.cells.get(filter)));
        await store.publish(name, shot.pngs.get(filter));
      } catch (error) {
        log.warn(`Photobooth: publish failed: ${error.message}`);
        await notify("download not available", 3);
        return;
      }
      const url = `${publicUrl}/p/${name}`;
      log.info(`Photobooth: published ${url}`);
      await show(renderQr(url, caption) || renderUrl(url), { menuHint: false });
      // any key or the timeout brings the picture back; a key arriving during the redraw is dropped
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, qrTimeoutMs);
        m.key().then(() => { clearTimeout(timer); resolve(); }, () => { clearTimeout(timer); resolve(); });
      });
      await showPicture();
    }

    await show(renderIdle());
    camera.open?.();
    try {
      while (true) {
        const [char, key] = await m.key();
        lastKey = key;
        const letter = char.toUpperCase();
        if (key === m.sommaire) break;
        if (char === " ") {
          await capture();
        } else if (letter === "F" && shot) {
          index = (index + 1) % FILTERS.length;
          await showPicture();
        } else if (letter === "D" && shot) {
          await download();
        } else {
          await notify("keys at the bottom");
        }
      }
    } finally {
      clearTimeout(erase);
      camera.close?.();
    }
    return lastKey;
  };
}
