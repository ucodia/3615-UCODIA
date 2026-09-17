import { Minitel } from "../minitel.js";
import logger from "../logger.js";
import { encode } from "../screen.js";
import { qrBitmap } from "./qr.js";
import { MAP_URL } from "./venables-data.js";
import {
  renderMapPage,
  renderQrPage,
  renderLegendNotes,
  pageCount,
  homePage,
} from "./venables-screens.js";

const MARQUEE_MS = 400;

const qrVideotex = encode(renderQrPage(qrBitmap(MAP_URL)));
const mapVideotex = Array.from({ length: pageCount() }, (_, page) =>
  encode(renderMapPage(page)),
);

function startMarquee(m, page) {
  let offset = 1;
  const timer = setInterval(() => {
    const frame = encode(renderLegendNotes(page, offset++));
    if (frame) m.send(frame).catch((error) => logger.warn(`Marquee: ${error.message}`));
  }, MARQUEE_MS);
  return () => clearInterval(timer);
}

async function drawCompass(m) {
  await m.pos(4, 2);
  await m.color(m.blanc);
  await m.print("↑");
  await m.pos(5, 2);
  await m.print("N");
}

async function drawMapFooter(m, page, pageTotal) {
  if (page > 0) {
    await m.pos(23, 1);
    await m.color(m.vert);
    await m.print("go west ");
    await m.inverse();
    await m.color(m.cyan);
    await m.print(" ← ");
    await m.inverse(0);
  }
  if (page + 1 < pageTotal) {
    await m.pos(23, 30);
    await m.color(m.vert);
    await m.print("go east ");
    await m.inverse();
    await m.color(m.cyan);
    await m.print(" → ");
    await m.inverse(0);
  }
  await m.pos(24, 1);
  await m.color(m.vert);
  await m.print("main menu → ");
  await m.inverse();
  await m.color(m.cyan);
  await m.print("SOMMAIRE");
  await m.inverse(0);
  await m.pos(24, 26);
  await m.color(m.vert);
  await m.print("QR code → ");
  await m.inverse();
  await m.color(m.cyan);
  await m.print("ENVOI");
  await m.inverse(0);
}

async function showQrPage(m) {
  logger.info("Navigating to venables vibes QR page");
  await m.home();
  await m.send(qrVideotex);
  await m.pos(24, 1);
  await m.color(m.vert);
  await m.print("back → ");
  await m.inverse();
  await m.color(m.cyan);
  await m.print("RETOUR");
  await m.inverse(0);
  await m.key();
}

async function venablesVibes(websocket) {
  const m = new Minitel(websocket);
  const pageTotal = mapVideotex.length;
  let page = homePage();
  let lastKey = 0;
  let skipFrame = false;

  while (true) {
    if (!skipFrame) {
      logger.info(`Navigating to venables vibes page ${page + 1}`);
      await m.home();
      await m.send(mapVideotex[page]);
      await drawCompass(m);
      await drawMapFooter(m, page, pageTotal);
    } else {
      skipFrame = false;
    }

    const stopMarquee = startMarquee(m, page);
    const [, key] = await m.key();
    stopMarquee();
    lastKey = key;

    if (key === m.suite || key === m.droite) {
      if (page + 1 < pageTotal) {
        page++;
      } else {
        await m.message(0, 8, 2, "You're on the last page", true);
        skipFrame = true;
      }
    } else if (key === m.retour || key === m.gauche) {
      if (page > 0) {
        page--;
      } else {
        await m.message(0, 8, 2, "You're on the first page", true);
        skipFrame = true;
      }
    } else if (key === m.envoi) {
      await showQrPage(m);
    } else if (key === m.sommaire) {
      break;
    } else {
      await m.message(0, 6, 2, "Use keys at bottom of screen", true);
      skipFrame = true;
    }
  }

  return lastKey;
}

export { venablesVibes };
