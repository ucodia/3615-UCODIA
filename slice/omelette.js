import { Minitel } from "../minitel.js";
import logger from "../logger.js";

async function omeletteFacts(websocket) {
  const m = new Minitel(websocket);
  await displayOmeletteFacts(m);
}

async function displayOmeletteFacts(m) {
  let lastKey = 0;
  let skipFrame = false;

  while (true) {
    if (!skipFrame) {
      logger.info("Navigating to omelette facts page");
      await m.home();

      // header
      await m.xdraw("screens/omelette-small.vdt");
      await m.pos(1, 9);
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
      await m.printblock(4, 21, 19, "- Her birthname is Flower");
      await m.printblock(
        7,
        21,
        19,
        "- She loves watching camping channels on YouTube",
      );
      await m.printblock(
        11,
        21,
        19,
        "- She visits the highschool everyday where she gets special classroom treats",
      );
      await m.printblock(
        16,
        21,
        19,
        "- She has a taste for scandinavian furniture",
      );
      await m.printblock(
        20,
        21,
        19,
        "- Contrary to popular belief, she is the actual Slice CEO",
      );

      // footer line
      await m.pos(23);
      await m.color(m.jaune);
      await m.plot("̶", 40);

      // footer menu
      await m.pos(24, 22);
      await m.color(m.vert);
      await m.print("close up →");
      await m.underline();
      await m.print(" ");
      await m.inverse();
      await m.color(m.cyan);
      await m.print("_SUITE  ");
      await m.pos(24, 1);
      await m.color(m.vert);
      await m.print("main menu → ");
      await m.inverse();
      await m.color(m.cyan);
      await m.print("SOMMAIRE");
    } else {
      skipFrame = false;
    }

    const [, key] = await m.key();
    lastKey = key;

    if (key === m.suite) {
      logger.info("Navigating to fullscreen omelette page");
      await m.home();
      await m.xdraw("screens/omelette-large.vdt");
      await m.key();
    } else if (key === m.retour || key === m.sommaire) {
      break;
    } else {
      await m.message(0, 6, 2, "Use keys at bottom of screen", true);
      skipFrame = true;
      continue;
    }
  }

  return lastKey;
}

export { omeletteFacts };
