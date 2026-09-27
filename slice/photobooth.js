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
const ROWS = 24;
const COUNTDOWN_MS = 1000;

export function hashOf(jpeg) {
  return createHash("sha256").update(jpeg).digest("hex").slice(0, 7);
}

// Every look at once, mirrored like a mirror, with one prepare per cell size.
export async function convertAll(jpeg) {
  const fields = new Map();
  const cells = new Map();
  for (const name of FILTERS) {
    const preset = PRESETS[name];
    const cell = cellSize(preset.method);
    const key = cell.join("x");
    if (!fields.has(key)) fields.set(key, await prepare(jpeg, COLS, ROWS, { cell, mirror: true }));
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
  convert = convertAll,
  log = logger,
  ttl = 300,
}) {
  const caption = `scan to download - expires in ${Math.max(1, Math.round(ttl / 60))} min`;
  return async function photobooth(websocket) {
    const m = makeMinitel(websocket);
    let shot = null;
    let index = 0;
    let lastKey = 0;

    const show = async (screen) => {
      await m.home();
      await m.cls();
      await m.send(encode(screen));
    };
    const showPicture = () => show(renderPicture(shot.cells.get(FILTERS[index])));
    const notify = (text, seconds = 2) => m.message(0, 1, seconds, text, true);

    async function capture() {
      for (const digit of [3, 2, 1]) {
        await show(renderCountdown(digit));
        await sleep(COUNTDOWN_MS);
      }
      await show(renderSmile());
      try {
        const jpeg = await camera.capture();
        shot = { hash: hashOf(jpeg), cells: await convert(jpeg), pngs: new Map() };
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
      await show(renderQr(url, caption) || renderUrl(url));
      const [, key] = await m.key();
      if (key === m.sommaire) return key;
      await showPicture();
      return 0;
    }

    await show(renderIdle());
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
        await notify(`applied ${FILTERS[index]} filter`);
      } else if (letter === "D" && shot) {
        if ((await download()) === m.sommaire) {
          lastKey = m.sommaire;
          break;
        }
      } else {
        await notify("use keys at bottom of screen");
      }
    }
    return lastKey;
  };
}
