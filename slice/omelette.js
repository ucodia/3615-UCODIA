import { Minitel } from "../minitel.js";
import logger from "../logger.js";

// Approximate, until the real date is known: she is a Scorpio and turned 7 in 2025.
const BIRTHDATE = new Date(2018, 10, 1);

function ageInYears(birthdate, today = new Date()) {
  let age = today.getFullYear() - birthdate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthdate.getMonth() ||
    (today.getMonth() === birthdate.getMonth() && today.getDate() < birthdate.getDate());
  return beforeBirthday ? age - 1 : age;
}

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
      await m.xdraw("screens/omelette-face.vdt");
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
      await m.print(`Age:   ${ageInYears(BIRTHDATE)} y.o.`);
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
      await m.pos(24, 29);
      await m.color(m.vert);
      await m.print("gallery ");
      await m.inverse();
      await m.color(m.cyan);
      await m.print(" 3 ");
      await m.inverse(0);
      await m.pos(24, 1);
      await m.color(m.vert);
      await m.print("main menu → ");
      await m.inverse();
      await m.color(m.cyan);
      await m.print("SOMMAIRE");
    } else {
      skipFrame = false;
    }

    const [char, key] = await m.key();
    lastKey = key;

    if (key === m.suite || key === m.droite || char === "3") {
      await displayGallery(m);
    } else if (key === m.retour || key === m.gauche || key === m.sommaire) {
      break;
    } else {
      await m.message(0, 6, 2, "Use keys at bottom of screen", true);
      skipFrame = true;
      continue;
    }
  }

  return lastKey;
}

const GALLERY = ["01", "02", "03", "04"].map((n) => `screens/omelette-gallery-${n}.vdt`);

// Full-screen pictures with the keys on the bottom row. 1/3 page because SUITE and RETOUR
// are dead on the gallery terminal; the arrows and SUITE/RETOUR still work in the emulator.
async function displayGallery(m) {
  let index = 0;
  while (true) {
    logger.info(`Navigating to omelette gallery ${index + 1}`);
    await m.home();
    await m.xdraw(GALLERY[index]);
    // the exhibits footer keys on a black row 24, without the rule
    await m.pos(24, 1);
    await m.backcolor(m.noir);
    await m.plot(" ", 40);
    await m.pos(24, 23);
    await m.color(m.vert);
    await m.print("prev ");
    await m.inverse();
    await m.color(m.cyan);
    await m.print(" 1 ");
    await m.inverse(0);
    await m.pos(24, 33);
    await m.color(m.vert);
    await m.print("next ");
    await m.inverse();
    await m.color(m.cyan);
    await m.print(" 3 ");
    await m.inverse(0);
    await m.pos(24, 1);
    await m.color(m.vert);
    await m.print("back → ");
    await m.inverse();
    await m.color(m.cyan);
    await m.print("SOMMAIRE");
    await m.inverse(0);
    const [char, key] = await m.key();
    if (key === m.suite || key === m.droite || char === "3") index = (index + 1) % GALLERY.length;
    else if (key === m.retour || key === m.gauche || char === "1") index = (index + GALLERY.length - 1) % GALLERY.length;
    else return;
  }
}

export { omeletteFacts, displayOmeletteFacts, ageInYears };
