import { Minitel } from "../minitel.js";
import { startServer } from "../server.js";
import { getShows } from "./schedule.js";

async function sliceExhibits(websocket) {
  const m = new Minitel(websocket);

  // Initial setup
  await m.home();
  await displayExhibitSchedule(m);

  // Listen for ENVOI key to generate new artwork or SOMMAIRE to return to welcome page
  while (true) {
    const [_, key] = await m.input(24, 40, 0, "", " ", false);

    if (key === m.envoi) {
      await display(m);
    } else if (key === m.sommaire) {
      break;
    }
  }
}

async function displayExhibitSchedule(m) {
  await m.cls();
  // await m.gr();

  const shows = await getShows();

  let page = 1;
  let perPage = 5;
  let pageTotal = Math.ceil(shows.length / perPage);
  let lastKey = 0;

  while (true) {
    await m.home();
    await m.print(`Page ${page} - Exhbit Schedule`, 1, 1);

    const [choix, key] = await m.input(0, 1, 0, "");
    lastKey = key;

    await m.cursor(false);
    if (key === m.suite) {
      if (page < pageTotal) {
        page++;
      } else {
        await m.bip();
      }
    } else if (key === m.retour) {
      if (page > 1) {
        page--;
      } else {
        await m.bip();
      }
    } else if (key === m.sommaire) {
      break;
    } else if (key === m.correction) {
      return key;
    } else if (key !== m.repetition) {
      await m.bip();
    }

    console.log(`Page: ${page}, Key: ${key}`);
  }

  return lastKey;
}

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async function () {
    startServer((ws) => seine(ws), 3613, "Slice");
  })().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}

export { sliceExhibits };
