import { Minitel } from "../minitel.js";
import { startServer } from "../server.js";
import { getExhibits, getWorkshops } from "./schedule.js";

async function sliceExhibits(websocket) {
  const m = new Minitel(websocket);
  await displayExhibitSchedule(m);
}

async function sliceWorkshops(websocket) {
  const m = new Minitel(websocket);
  await displayWorkshopSchedule(m);
}

async function filterAndSortUpcomingEvents(events) {
  const now = new Date();
  return events
    .filter((event) => new Date(event.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { weekday: "long", month: "long", day: "numeric" };
  return date
    .toLocaleDateString("en-US", options)
    .replace(/\b(\d{1,2})(?=\b)/, (match) => {
      const suffix = ["th", "st", "nd", "rd"][
        match % 10 > 3 || Math.floor((match % 100) / 10) === 1 ? 0 : match % 10
      ];
      return match + suffix;
    });
}

async function displayExhibitSchedule(m) {
  const events = await filterAndSortUpcomingEvents(await getExhibits());

  let page = 0;
  let perPage = 5;
  let pageTotal = Math.ceil(events.length / perPage);
  let lastKey = 0;
  let skipFrame = false;

  while (true) {
    if (!skipFrame) {
      const pageEvents = events.slice(page * perPage, (page + 1) * perPage);
      await m.home();

      // header
      await m.pos(1, 4);
      await m.color(m.jaune);
      await m.print(`UPCOMING EXHIBITS @ Slice`);
      await m.pos(2);
      await m.color(m.jaune);
      await m.plot("̶", 40);

      for (let i = 0; i < pageEvents.length; i++) {
        const lineBegin = 3 + i * 4;
        const event = pageEvents[i];
        // console.log(JSON.stringify(event, null, 2));

        // page index
        await m.pos(1, 36);
        await m.print(`${(page + 1).toString().padStart(2, "0")}/${pageTotal}`);
        await m.pos(3);

        // selection number
        await m.pos(lineBegin, 2);
        await m.color(m.blanc);
        await m.print((i + 1).toString());

        // date
        await m.pos(lineBegin, 4);
        await m.color(m.vert);
        await m.print(`${formatDate(event.date)}`);

        // event name
        await m.pos(lineBegin + 1, 4);
        await m.color(m.blanc);
        await m.print(event.name.substring(0, 36));
        if (event.name.length > 36) {
          await m.pos(lineBegin + 2, 4);
          await m.print(event.name.substring(36, 36 * 2));
        }

        // item seperator
        await m.pos(lineBegin + 3, 4);
        await m.color(m.jaune);
        if (i !== pageEvents.length - 1) {
          await m.plot("̶", 37);
        }
      }

      // footer line
      await m.pos(22);
      await m.color(m.jaune);
      await m.plot("̶", 40);

      // footer menu
      if (page > 0) {
        await m.pos(23, 22);
        await m.color(m.vert);
        await m.print("previous →");
        await m.underline();
        await m.print(" ");
        await m.inverse();
        await m.color(m.cyan);
        await m.print("_RETOUR ");
      }
      if (page + 1 < pageTotal) {
        await m.pos(24, 26);
        await m.color(m.vert);
        await m.print("next →");
        await m.underline();
        await m.print(" ");
        await m.inverse();
        await m.color(m.cyan);
        await m.print("_SUITE  ");
      }
      await m.pos(24, 1);
      await m.color(m.vert);
      await m.print("main menu → ");
      await m.inverse();
      await m.color(m.cyan);
      await m.print("SOMMAIRE");
    } else {
      skipFrame = false;
    }

    const [choix, key] = await m.input(0, 1, 0, "");
    lastKey = key;

    await m.cursor(false);
    if (key === m.suite) {
      if (page + 1 < pageTotal) {
        page++;
      } else {
        await m.bip();
        skipFrame = true;
      }
    } else if (key === m.retour) {
      if (page > 0) {
        page--;
      } else {
        await m.bip();
        skipFrame = true;
      }
    } else if (key === m.sommaire) {
      break;
    } else if (key === m.correction) {
      return key;
    } else if (key !== m.repetition) {
      await m.bip();
    }
  }

  return lastKey;
}

async function displayWorkshopSchedule(m) {
  const events = await filterAndSortUpcomingEvents(await getWorkshops());

  let page = 0;
  let perPage = 5;
  let pageTotal = Math.ceil(events.length / perPage);
  let lastKey = 0;
  let skipFrame = false;

  while (true) {
    if (!skipFrame) {
      const pageEvents = events.slice(page * perPage, (page + 1) * perPage);
      await m.home();

      // header
      await m.pos(1, 4);
      await m.color(m.jaune);
      await m.print(`UPCOMING WORKSHOPS @ Slice`);
      await m.pos(2);
      await m.color(m.jaune);
      await m.plot("̶", 40);

      for (let i = 0; i < pageEvents.length; i++) {
        const lineBegin = 3 + i * 4;
        const event = pageEvents[i];
        // console.log(`event: ${JSON.stringify(event, null, 2)}`);

        // page index
        await m.pos(1, 36);
        await m.print(`${(page + 1).toString().padStart(2, " ")}/${pageTotal}`);
        await m.pos(3);

        // selection number
        await m.pos(lineBegin, 2);
        await m.color(m.blanc);
        await m.print((i + 1).toString());

        // date
        await m.pos(lineBegin, 4);
        await m.color(m.vert);
        await m.print(`${formatDate(event.date)}`);

        // price / availability
        if (event.quantity === 0) {
          await m.pos(lineBegin, 36);
          await m.color(m.rouge);
          await m.print("FULL");
        } else if (event.price === 0) {
          await m.pos(lineBegin, 36);
          await m.color(m.vert);
          await m.print("FREE");
        } else {
          await m.pos(lineBegin, 36);
          await m.color(m.bleu);
          await m.print(`${event.price.toString().padStart(3, " ")}$`);
        }

        // event name
        await m.pos(lineBegin + 1, 4);
        await m.color(m.blanc);
        await m.print(event.name.substring(0, 36));
        if (event.name.length > 36) {
          await m.pos(lineBegin + 2, 4);
          await m.print(event.name.substring(36, 36 * 2));
        }

        // item seperator
        await m.pos(lineBegin + 3, 4);
        await m.color(m.jaune);
        if (i !== pageEvents.length - 1) {
          await m.plot("̶", 37);
        }
      }

      // footer line
      await m.pos(22);
      await m.color(m.jaune);
      await m.plot("̶", 40);

      // footer menu
      if (page > 0) {
        await m.pos(23, 22);
        await m.color(m.vert);
        await m.print("previous →");
        await m.underline();
        await m.print(" ");
        await m.inverse();
        await m.color(m.cyan);
        await m.print("_RETOUR ");
      }
      if (page + 1 < pageTotal) {
        await m.pos(24, 26);
        await m.color(m.vert);
        await m.print("next →");
        await m.underline();
        await m.print(" ");
        await m.inverse();
        await m.color(m.cyan);
        await m.print("_SUITE  ");
      }
      await m.pos(24, 1);
      await m.color(m.vert);
      await m.print("main menu → ");
      await m.inverse();
      await m.color(m.cyan);
      await m.print("SOMMAIRE");
    } else {
      skipFrame = false;
    }

    const [choix, key] = await m.input(0, 1, 0, "");
    lastKey = key;

    await m.cursor(false);
    if (key === m.suite) {
      if (page + 1 < pageTotal) {
        page++;
      } else {
        await m.bip();
        skipFrame = true;
      }
    } else if (key === m.retour) {
      if (page > 0) {
        page--;
      } else {
        await m.bip();
        skipFrame = true;
      }
    } else if (key === m.sommaire) {
      break;
    } else if (key === m.correction) {
      return key;
    } else if (key !== m.repetition) {
      await m.bip();
    }
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

export { sliceExhibits, sliceWorkshops };
