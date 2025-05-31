import { Minitel } from "../minitel.js";

async function omeletteFacts(websocket) {
  const m = new Minitel(websocket);
  await displayOmeletteFacts(m);
}

async function displayOmeletteFacts(m) {
  let lastKey = 0;

  while (true) {
    await m.home();

    // header
    // await m.dr
    // await m.xdraw("screens/omelette-small.vdt");
    await m.pos(1, 8);
    await m.color(m.jaune);
    await m.print(`FUN FACTS ABOUT OMELETTE!`);
    await m.pos(2);
    await m.color(m.jaune);
    await m.plot("̶", 40);

    // content
    await m.pos(17, 3);
    await m.print("Name:  Omelette");
    await m.pos(18, 3);
    await m.print("Age:   5 y.o.");
    await m.pos(19, 3);
    await m.print("Sign:  Scorpio");
    await m.pos(20, 3);
    await m.print("Style: Orange");
    await m.printblock(3, 21, 19, "- Her birthname is Flower");
    await m.printblock(
      6,
      21,
      19,
      "- She loves watching camping channels on YouTube"
    );

    // footer line
    await m.pos(22);
    await m.color(m.jaune);
    await m.plot("̶", 40);

    // footer menu
    await m.pos(24, 1);
    await m.color(m.vert);
    await m.print("main menu → ");
    await m.inverse();
    await m.color(m.cyan);
    await m.print("SOMMAIRE");

    const [choix, key] = await m.input(0, 1, 0, "");
    lastKey = key;

    await m.cursor(false);
    if (key === m.suite) {
      await displayFullscreenOmelette(m);
    } else if (key === m.retour) {
      await m.bip();
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

async function displayFullscreenOmelette(m) {
  let lastKey = 0;

  while (true) {
    await m.home();

    // header
    await m.xdraw("screens/omelette-small.vdt");

    // footer line
    await m.pos(22);
    await m.color(m.jaune);
    await m.plot("̶", 40);

    // footer menu
    await m.pos(24, 1);
    await m.color(m.vert);
    await m.print("main menu → ");
    await m.inverse();
    await m.color(m.cyan);
    await m.print("SOMMAIRE");

    const [choix, key] = await m.input(0, 1, 0, "");
    lastKey = key;

    await m.cursor(false);
    if (key === m.suite) {
      if (page + 1 < pageTotal) {
        page++;
      } else {
        await m.bip();
      }
    } else if (key === m.retour) {
      if (page > 0) {
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
  }

  return lastKey;
}

export { omeletteFacts };
