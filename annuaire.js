import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { Minitel, MinitelWS } from "./minitel.js";
import { startServer } from "./server.js";

const annuaires = {
  "tel.fr": annuaireTelfr,
  "118000.fr": annuaire118000fr,
};

async function recherche(quoi, ou) {
  for (const nomAnnuaire in annuaires) {
    try {
      const results = await annuaires[nomAnnuaire](quoi, ou);
      if (results && results.length > 0) {
        // If we found any results
        console.log(`Found ${results.length} results from ${nomAnnuaire}`);
        return [results, nomAnnuaire];
      }
    } catch (e) {
      console.log(`Error searching ${nomAnnuaire}: ${e}`);
      continue;
    }
  }

  // If no results found from any provider
  return [[], "Aucun résultat"];
}

async function annuaireTelfr(qui, ou) {
  const res = [];

  try {
    console.log(`Searching tel.fr for "${qui}" in "${ou}"`);

    const response = await fetch(
      `https://www.tel.fr/pro/search?q=${encodeURIComponent(
        qui
      )}&w=${encodeURIComponent(ou)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find all info blocks
    $(".info").each((i, element) => {
      let nom = "",
        adresse = "",
        cp = "",
        ville = "",
        tel = "";

      // Get name
      const nameElem = $(element).find("h2");
      if (nameElem.length) {
        nom = nameElem.text().trim();
      }

      // Get address components
      const addr = $(element).find("address");
      if (addr.length) {
        const villeElem = addr.find("span[data-place-city]");
        ville = villeElem.length ? villeElem.text().trim() : "";

        // Get address lines
        const addrLines = addr
          .text()
          .replace(/\n/g, "")
          .split("  ")
          .filter((s) => s !== "")
          .map((s) => s.trim());

        // Find the index of the city in the address lines
        const villeIndex = addrLines.findIndex((line) => line === ville);

        if (villeIndex !== -1) {
          const addrLinesBeforeCity = addrLines.slice(0, villeIndex);

          if (addrLinesBeforeCity.length === 1) {
            cp = addrLinesBeforeCity[0];
          } else if (addrLinesBeforeCity.length >= 2) {
            adresse = addrLinesBeforeCity[0];
            cp = addrLinesBeforeCity[1];
          }
        }
      }

      // Get phone
      const phoneElem = $(element).find(".phone");
      if (phoneElem.length) {
        const phoneText = phoneElem.text();
        const phoneMatch = phoneText.match(/:(.*)/);
        if (phoneMatch) {
          tel = phoneMatch[1]
            .replace(/\xa0/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/-/g, " ")
            .trim();
        }
      }

      res.push({ nom, adresse, cp, ville, tel });
    });

    return res;
  } catch (error) {
    console.error("Error searching tel.fr:", error);
    return [];
  }
}

async function annuaire118000fr(qui, ou) {
  const res = [];

  try {
    console.log(`Searching 118000.fr for "${qui}" in "${ou}"`);

    const response = await fetch(
      `https://www.118000.fr/search?who=${encodeURIComponent(
        qui
      )}&label=${encodeURIComponent(ou)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $("section.card").each((i, element) => {
      let nom = "",
        adresse = "",
        cp = "",
        ville = "",
        tel = "";

      // Get name
      const nameElem = $(element).find("h2.name a");
      if (nameElem.length) {
        nom = nameElem.text().trim();
      }

      // Get address
      const addrElem = $(element).find("div.address");
      if (addrElem.length) {
        // Split address into city and postal code
        const addrText = addrElem.text().trim();
        // Extract postal code (5 digits) and city
        const cpMatch = addrText.match(/(\d{5})\s+(.*)/);
        if (cpMatch) {
          cp = cpMatch[1];
          ville = cpMatch[2];
        } else {
          ville = addrText;
        }
      }

      // Get phone number
      const telElem = $(element).find("p.phone a");
      if (telElem.length) {
        tel = telElem.text().trim();
      }

      res.push({ nom, adresse, cp, ville, tel });
    });

    return res;
  } catch (error) {
    console.error("Error searching 118000.fr:", error);
    return [];
  }
}

async function pageRecherche(m, quoi, ou) {
  // Define input zones
  m.resetzones();
  m.zone(5, 13, 27, quoi, m.blanc);
  m.zone(7, 13, 27, "", m.blanc);
  m.zone(10, 13, 27, ou, m.blanc);
  m.zone(13, 13, 27, "", m.blanc);
  m.zone(14, 13, 27, "", m.blanc);
  m.zone(15, 13, 27, "", m.blanc);
  let touche = m.repetition;
  let zone = 1;

  while (true) {
    // Initial display or repetition
    if (touche === m.repetition) {
      await m.home();
      await m.xdraw("ecrans/annuaire.vtx");
    }

    // Current input zone management
    [zone, touche] = await m.waitzones(zone);
    // Get what and where...
    quoi = `${m.zones[0].texte} ${m.zones[1].texte} ${m.zones[5].texte}`
      .trim()
      .replace("  ", " ");
    ou = `${m.zones[4].texte} ${m.zones[3].texte} ${m.zones[2].texte}`
      .trim()
      .replace("  ", " ");

    if (touche === m.sommaire) {
      return [touche, "", ""];
    }
    if (touche === m.envoi) {
      if (quoi === "") {
        await m.message(0, 1, 3, "Entrez au moins un nom ou une rubrique !");
      } else {
        return [touche, quoi, ou];
      }
    } else if (touche !== m.repetition) {
      await m.message(0, 1, 3, "Désolé, pas encore disponible");
    }
  }
}

async function pageResultats(m, quoi, ou, res, annu = "") {
  let page = 1;
  let lastTouche = 0;

  while (true) {
    if (page > 0) {
      // display
      // header on 2 lines + separator
      await m.home();
      await m.print(quoi.toUpperCase());
      if (ou.trim() !== "") {
        await m.print(` à ${ou.toUpperCase()}`);
      }
      await m.pos(2);
      await m.color(m.bleu);
      await m.plot("̶", 40);
      if (annu !== "") {
        await m.pos(23, 1);
        await m.color(m.bleu);
        await m.print("(C)\r\n" + annu);
      }

      // multiple pages?
      if (res.length > 5) {
        await m.pos(1, 37);
        await m.print(` ${Math.abs(page)}/${Math.ceil(res.length / 5)}`);
        await m.pos(3);
      }

      // first result line
      await m.pos(3);
      for (let i = (page - 1) * 5; i < page * 5; i++) {
        if (i < res.length) {
          let { nom, adresse, cp, ville, tel } = res[i];
          if (!adresse) {
            adresse = "(adresse masquée)";
          }
          if (!tel) {
            tel = " (num. masqué)";
          }
          await m.color(m.blanc);
          await m.print(String(i + 1).padStart(3, " "));
          await m.print(
            ` ${nom.substring(0, 20).padEnd(36 - tel.length, " ")}${tel}`
          );
          await m.color(m.vert);
          await m.print(
            `    ${adresse.substring(0, 35)}\r\n    ${cp} ${ville}\r\n`
          );
          await m.color(m.bleu);
          if (i < page * 5) {
            await m.plot(" ", 4);
            await m.plot("̶", 36);
          }
        }
      }

      // final line
      await m.pos(22);
      await m.color(m.bleu);
      await m.plot("̶", 40);

      if (page > 1) {
        if (res.length > page * 5) {
          // room for SUITE
          await m.pos(22, 15);
        } else {
          await m.pos(23, 15);
        }
        await m.color(m.vert);
        await m.print("page précédente →");
        await m.underline();
        await m.print(" ");
        await m.inverse();
        await m.color(m.cyan);
        await m.print("_RETOUR ");
      }
      if (res.length > page * 5) {
        await m.pos(23, 17);
        await m.color(m.vert);
        await m.print("page suivante →");
        await m.underline();
        await m.print(" ");
        await m.inverse();
        await m.color(m.cyan);
        await m.print("_SUITE  ");
      }

      await m.pos(24, 15);
      await m.color(m.vert);
      await m.print("autre recherche → ");
      await m.inverse();
      await m.color(m.cyan);
      await m.print("SOMMAIRE");
    } else {
      page = Math.abs(page);
    }

    // wait for input
    const [choix, touche] = await m.input(0, 1, 0, "");
    lastTouche = touche;

    await m.cursor(false);
    if (touche === m.suite) {
      if (page * 5 < res.length) {
        page = page + 1;
      } else {
        await m.bip();
        page = -page; // no redisplay
      }
    } else if (touche === m.retour) {
      if (page > 1) {
        page = page - 1;
      } else {
        await m.bip();
        page = -page; // no redisplay
      }
    } else if (touche === m.sommaire) {
      break;
    } else if (touche === m.correction) {
      // return to input for correction
      return touche;
    } else if (touche !== m.repetition) {
      await m.bip();
      page = -page; // no redisplay
    }
  }

  return lastTouche;
}

async function annuaire(websocket) {
  const m = new Minitel(new MinitelWS(websocket));

  let annuQuoi = "";
  let annuOu = "";

  const args = process.argv.slice(2);
  if (args.length > 1) {
    annuQuoi = args[0];
    annuOu = args[1];
  }

  while (true) {
    const [touche, newQuoi, newOu] = await pageRecherche(m, annuQuoi, annuOu);
    annuQuoi = newQuoi;
    annuOu = newOu;

    if (touche === m.envoi) {
      // launch search
      await m.cursor(false);
      await m.pos(0, 1);
      await m.flash();
      await m.print("Recherche... ");
      const [resultat, annu] = await recherche(annuQuoi, annuOu);
      if (resultat.length === 0) {
        await m.message(0, 1, 3, "Aucune adresse trouvée");
      } else {
        const result = await pageResultats(m, annuQuoi, annuOu, resultat, annu);
        if (result !== m.correction) {
          annuQuoi = "";
          annuOu = "";
        }
      }
    } else if (touche === m.sommaire) {
      break;
    }
  }
}

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async function () {
    startServer((ws) => annuaire(ws), 3611, "Annuaire");
  })().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}

export { annuaire };
