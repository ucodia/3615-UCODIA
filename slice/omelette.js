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
    await m.pos(1, 4);
    await m.color(m.jaune);
    await m.print(`OMELETTE FACTS`);
    await m.pos(2);
    await m.color(m.jaune);
    await m.plot("̶", 40);

    // content
    await m.xdraw("omelette.vdt");

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
