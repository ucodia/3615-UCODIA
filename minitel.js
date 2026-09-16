import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class Minitel {
  /**
   * Class for managing videotex input/output with a Minitel
   * @param {WebSocket} websocket - WebSocket connection
   */
  constructor(websocket) {
    this.ecrans = { last: null };
    this.ws = websocket;
    this.buffer = "";
    this.lastkey = 0;
    this.lastscreen = "";
    this.laststar = false;
    this.zones = [];
    this.zonenumber = 0;

    // Color constants
    this.noir = 0;
    this.rouge = 1;
    this.vert = 2;
    this.jaune = 3;
    this.bleu = 4;
    this.magenta = 5;
    this.cyan = 6;
    this.blanc = 7;
    this.gris1 = 4;
    this.gris2 = 1;
    this.gris3 = 5;
    this.gris4 = 2;
    this.gris5 = 6;
    this.gris6 = 3;

    // Function key constants for Minitel
    // in Videotex or Mixed mode
    this.envoi = 1;
    this.retour = 2;
    this.repetition = 3;
    this.guide = 4;
    this.annulation = 5;
    this.sommaire = 6;
    this.correction = 7;
    this.suite = 8;
    this.connexionfin = 9;

    // Cursor key constants
    this.haut = 10;
    this.bas = 11;
    this.droite = 12;
    this.gauche = 13;

    // Protocol sequence constants
    this.PRO1 = "\x1b\x39";
    this.PRO2 = "\x1b\x3a";
    this.PRO3 = "\x1b\x3b";
  }

  // Private WebSocket methods
  async #write(data) {
    if (typeof data === "string") {
      await this.ws.send(data);
    } else {
      // If data is a Uint8Array, convert it to a string
      const dataStr = new TextDecoder().decode(data);
      // Remove any 0xFF characters and everything after
      const ffIndex = dataStr.indexOf("\xff");
      const cleanData =
        ffIndex > 0 ? dataStr.substring(0, ffIndex - 1) : dataStr;
      await this.ws.send(cleanData);
    }
  }

  async #read(maxlen = 1) {
    if (this.buffer.length < maxlen) {
      try {
        // This assumes the WebSocket is set up to receive messages
        // and store them in a way that can be accessed here
        const data = await new Promise((resolve) => {
          this.ws.onmessage = (event) => resolve(event.data);
        });
        this.buffer += data;
      } catch (error) {
        console.error("Error reading from WebSocket:", error);
      }
    }

    let data = "";
    if (this.buffer.length >= maxlen) {
      data = this.buffer.substring(0, maxlen);
      this.buffer = this.buffer.substring(maxlen);
    }

    return data;
  }

  #inWaiting() {
    return this.buffer.length;
  }

  /**
   * Wait for a connection
   */
  async wait() {
    console.log("ATTENTE");

    // ESC received... we consider we are connected
    while ((await this.#read(1)) !== " ") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("CONNECTION");
  }

  /**
   * End connection, hang up
   */
  async end() {
    await this.#write("\x1b9g");
  }

  /**
   * Last character received
   */
  async if() {
    const data = await this.#read(1);
    if (!data) {
      return null;
    } else {
      return data;
    }
  }

  /**
   * Clear screen and line 0
   */
  async home() {
    await this.del(0, 1);
    await this.sendchr(12); // FF
    await this.cursor(false); // Coff
  }

  /**
   * Position cursor at the beginning of a line
   */
  async vtab(ligne) {
    await this.pos(ligne, 1);
  }

  /**
   * Position cursor at a line/column
   */
  async pos(ligne, colonne = 1) {
    if (ligne === 1 && colonne === 1) {
      await this.sendchr(30);
    } else {
      await this.sendchr(31);
      await this.sendchr(64 + ligne);
      await this.sendchr(64 + colonne);
    }
  }

  /**
   * Delete to end of line
   */
  async del(ligne, colonne) {
    await this.pos(ligne, colonne);
    await this.sendchr(24);
  }

  /**
   * Switch to normal video
   */
  async normal() {
    await this.sendesc("I");
  }

  /**
   * Change background color
   */
  async backcolor(couleur) {
    await this.sendesc(String.fromCharCode(80 + couleur));
  }

  /**
   * Clear a rectangle on the screen
   */
  async canblock(debut, fin, colonne, inverse = false) {
    if (inverse === false) {
      await this.pos(debut, colonne);
      await this.sendchr(24);
      for (let ligne = debut; ligne < fin; ligne++) {
        await this.sendchr(10);
        await this.sendchr(24);
      }
    } else {
      await this.pos(fin, colonne);
      await this.sendchr(24);
      for (let ligne = debut; ligne < fin; ligne++) {
        await this.sendchr(11);
        await this.sendchr(24);
      }
    }
  }

  /**
   * Clear end of line after specified column
   */
  async caneol(ligne, colonne) {
    await this.pos(ligne, colonne);
    await this.sendchr(24); // CAN
  }

  /**
   * Clear Minitel screen
   */
  async cls() {
    await this.home();
  }

  /**
   * Change text or graphic color
   */
  async color(couleur) {
    await this.sendesc(String.fromCharCode(64 + couleur));
  }

  /**
   * Make cursor visible or invisible
   */
  async cursor(visible) {
    if (visible === 1 || visible === true) {
      await this.sendchr(17); // Con
    } else {
      await this.sendchr(20); // Coff
    }
  }

  /**
   * Send a pre-loaded screen from a buffer to the minitel
   */
  async draw(num = 0) {
    if (num === null) {
      num = this.ecrans.last;
    }
    this.ecrans.last = num;
    if (num !== null) {
      await this.#write(this.ecrans[num]);
    }
  }

  /**
   * Send file content
   */
  async drawscreen(fichier) {
    try {
      const data = await fs.readFile(join(__dirname, fichier));
      await this.#write(data);
    } catch (error) {
      console.error(`Error loading file ${fichier}:`, error);
    }
  }

  /**
   * Switch to flashing mode
   */
  async flash(clignote = true) {
    if (clignote === null || clignote === true || clignote === 1) {
      await this.sendesc("\x48");
    } else {
      await this.sendesc("\x49");
    }
  }

  /**
   * Change character color
   */
  async forecolor(couleur) {
    await this.color(couleur);
  }

  /**
   * Return current input buffer content
   */
  async get() {
    return await this.#read(this.#inWaiting());
  }

  /**
   * Read Minitel ROM/RAM
   */
  async getid() {
    console.log("getid: not implemented...");
    return;
  }

  /**
   * Change background color
   */
  async hcolor(couleur) {
    await this.sendesc(String.fromCharCode(80 + couleur));
  }

  async #readKey() {
    const accents = {
      Aa: "à",
      Ca: "â",
      Ae: "è",
      Be: "é",
      Ce: "ê",
      He: "ë",
      Ci: "î",
      Hi: "ï",
      Co: "ô",
      Cu: "û",
      Hu: "ü",
      Kc: "ç",
      "\x6a": "Œ",
      "\x7a": "œ",
      "\x30": "°",
      "\x23": "£",
      "\x7b": "ß",
    };
    while (true) {
      const c = await this.#read(1);
      if (c === "") continue;
      if (c === "\r") return { char: "", key: this.envoi };
      if (c === "\x13") {
        const c2 = await this.#read(1);
        return { char: "", key: c2.charCodeAt(0) - 64 };
      }
      if (c === "\x1b") {
        const c2 = await this.#read(1);
        const escSeq = c + c2;
        if (escSeq === this.PRO1) await this.#read(1);
        else if (escSeq === this.PRO2) await this.#read(2);
        else if (escSeq === this.PRO3) await this.#read(3);
        else if (c2 === "[") {
          const key = this.#cursorKey(await this.#readCsiFinal());
          if (key !== 0) return { char: "", key };
        }
        continue;
      }
      if (c >= "\x08" && c <= "\x0b") {
        return { char: "", key: this.#cursorKey(c) };
      }
      if (c === "\x16" || c === "\x19") {
        let accent = await this.#read(1);
        if ("ABCHK".includes(accent)) accent += await this.#read(1);
        const ch = accents[accent];
        return { char: ch ?? c, key: 0 };
      }
      if (c >= " ") return { char: c, key: 0 };
    }
  }

  // Reads the remaining bytes of a CSI sequence (ESC [ ... final) and
  // returns the final byte
  async #readCsiFinal() {
    while (true) {
      const c = await this.#read(1);
      if (c === "") continue;
      if (c >= "@" && c <= "~") return c;
    }
  }

  // Maps a cursor key code to its constant, whether the keyboard sends
  // C0 codes (standard) or CSI sequences (extended)
  #cursorKey(c) {
    switch (c) {
      case "\x0b":
      case "A":
        return this.haut;
      case "\x0a":
      case "B":
        return this.bas;
      case "\x09":
      case "C":
        return this.droite;
      case "\x08":
      case "D":
        return this.gauche;
      default:
        return 0;
    }
  }

  async key() {
    const { char, key } = await this.#readKey();
    if (key !== 0) {
      this.lastkey = key;
      this.laststar = false;
    }
    return [char, key];
  }

  /**
   * Input zone management
   */
  async input(
    ligne,
    colonne,
    longueur,
    data = "",
    caractere = ".",
    redraw = true,
    envoiWhenFull = false,
  ) {
    // Initial display
    if (redraw) {
      await this.sendchr(20); // Coff
      await this.pos(ligne, colonne);
      await this.print(data);
      await this.plot(caractere, longueur - data.length);
    }
    await this.pos(ligne, colonne + data.length);
    await this.sendchr(17); // Con

    while (true) {
      const { char, key } = await this.#readKey();

      if (key === this.envoi) {
        this.lastkey = this.envoi;
        return [data, this.envoi];
      } else if (key === this.annulation && data !== "") {
        data = "";
        await this.sendchr(20); // Coff
        await this.pos(ligne, colonne);
        await this.print(data);
        await this.plot(caractere, longueur - data.length);
        await this.pos(ligne, colonne);
        await this.sendchr(17); // Con
      } else if (key === this.correction && data !== "") {
        await this.send(
          String.fromCharCode(8) + caractere + String.fromCharCode(8),
        );
        data = data.substring(0, data.length - 1);
      } else if (key !== 0) {
        this.lastkey = key;
        this.laststar =
          data !== "" && data.substring(data.length - 1) === "*";
        return [data, key];
      } else if (data.length >= longueur) {
        await this.bip();
      } else {
        data += char;
        await this.send(char);
        if (envoiWhenFull && data.length >= longueur) {
          this.lastkey = this.envoi;
          return [data, this.envoi];
        }
      }
    }
  }

  /**
   * Switch to inverse video
   */
  async inverse(inverse = 1) {
    if (inverse === null || inverse === 1 || inverse === true) {
      await this.sendesc("\x5D");
    } else {
      await this.sendesc("\x5C");
    }
  }

  /**
   * Position cursor
   */
  async locate(ligne, colonne) {
    await this.pos(ligne, colonne);
  }

  /**
   * Set keyboard to lowercase/uppercase mode
   */
  async lower(islower = true) {
    if (islower || islower === 1) {
      await this.send(this.PRO2 + "\x69\x45"); // switch keyboard to lowercase
    } else {
      await this.send(this.PRO2 + "\x6a\x45"); // return keyboard to uppercase
    }
  }

  /**
   * Display a message at a given position for a given time, then erase it
   */
  async message(ligne, colonne, delai, message, inverse = false) {
    await this.pos(ligne, colonne);
    if (inverse) {
      await this.inverse();
    }
    await this.print(message);
    await new Promise((resolve) => setTimeout(resolve, delai * 1000));
    await this.pos(ligne, colonne);
    await this.plot(" ", message.length);
  }

  /**
   * Send file content
   */
  async printscreen(fichier) {
    await this.drawscreen(fichier);
  }

  /**
   * Reset zones
   */
  resetzones() {
    this.zones = [];
  }

  /**
   * Scroll
   */
  async scroll(start = 1) {
    await this.step(this, start);
  }

  /**
   * Indicates if the last input ended with a star + function key
   */
  starflag() {
    return this.laststar;
  }

  /**
   * Switch to underlined mode or normal
   */
  async underline(souligne = true) {
    if (souligne === null || souligne === true || souligne === 1) {
      await this.sendesc(String.fromCharCode(90));
    } else {
      await this.sendesc(String.fromCharCode(89));
    }
  }

  /**
   * Input zones management
   */
  async waitzones(zone) {
    if (this.zones.length === 0) {
      return [0, 0];
    }

    zone = -zone;

    while (true) {
      // Initial display
      if (zone <= 0) {
        await this.cursor(false);
        for (const z of this.zones) {
          await this.pos(z.ligne, z.colonne);
          if (z.couleur !== this.blanc) {
            await this.forecolor(z.couleur);
          }
          await this.print(z.texte);
        }
        if (zone < 0) {
          zone = -zone;
        }
      }

      // Current input zone management
      const [text, touche] = await this.input(
        this.zones[zone - 1].ligne,
        this.zones[zone - 1].colonne,
        this.zones[zone - 1].longueur,
        this.zones[zone - 1].texte,
        ".",
        false,
      );
      this.zones[zone - 1].texte = text;

      // SUITE / RETOUR management
      if (touche === this.suite) {
        if (zone < this.zones.length) {
          zone = zone + 1;
        } else {
          zone = 1;
        }
      } else if (touche === this.retour) {
        if (zone > 1) {
          zone = zone - 1;
        } else {
          zone = this.zones.length;
        }
      } else {
        this.zonenumber = zone;
        await this.cursor(false);
        return [zone, touche];
      }
    }
  }

  /**
   * Declare an input zone
   */
  zone(ligne, colonne, longueur, texte, couleur) {
    this.zones.push({
      ligne,
      colonne,
      longueur,
      texte,
      couleur,
    });
  }

  lastKey() {
    return this.lastkey;
  }

  /**
   * Change text size
   */
  async scale(taille) {
    await this.sendesc(String.fromCharCode(76 + taille));
  }

  /**
   * Switch to underlined text
   */
  async notrace() {
    await this.sendesc(String.fromCharCode(89));
  }

  /**
   * End of underlined text
   */
  async trace() {
    await this.sendesc(String.fromCharCode(90));
  }

  /**
   * Repeated display of a character
   */
  async plot(car, nombre) {
    if (nombre > 1) {
      await this.print(car);
    }
    if (nombre === 2) {
      await this.print(car);
    } else if (nombre > 2) {
      while (nombre > 63) {
        await this.sendchr(18);
        await this.sendchr(64 + 63);
        nombre = nombre - 63;
      }
      await this.sendchr(18);
      await this.sendchr(64 + nombre - 1);
    }
  }

  /**
   * Text mode
   */
  async text() {
    await this.sendchr(15);
  }

  /**
   * Graphic mode
   */
  async gr() {
    await this.sendchr(14);
  }

  /**
   * Enable or disable scrolling mode
   */
  async step(scroll) {
    await this.sendesc(":");
    await this.sendchr("j".charCodeAt(0) - scroll);
    await this.send("C");
  }

  /**
   * Send file content
   */
  async xdraw(fichier) {
    try {
      const data = await fs.readFile(join(__dirname, fichier));
      await this.#write(data);
    } catch (error) {
      console.error(`Error loading file ${fichier}:`, error);
    }
  }

  /**
   * Load a videotex file into a buffer
   */
  async load(num, fichier) {
    try {
      const data = await fs.readFile(join(__dirname, fichier));
      this.ecrans[num] = data;
    } catch (error) {
      console.error(`Error loading file ${fichier}:`, error);
    }
  }

  /**
   * Read date and time
   */
  read() {
    console.log("read: not implemented");
  }

  /**
   * Print text with accents
   */
  async print(texte) {
    await this.send(this.accents(texte));
  }

  async printblock(ligne, colonne, largeur, texte, hyphenation = true) {
    const accentedText = this.accents(texte);
    let remainingText = accentedText;
    let currentLine = ligne;

    while (remainingText.length > 0) {
      await this.pos(currentLine, colonne);
      await this.send(remainingText.substring(0, largeur));
      remainingText = remainingText.substring(largeur);
      currentLine++;
    }
  }

  /**
   * Send data to the minitel
   */
  async send(text) {
    await this.#write(text);
  }

  /**
   * Send a character by its ASCII code
   */
  async sendchr(ascii) {
    await this.send(String.fromCharCode(ascii));
  }

  /**
   * Send an escape sequence
   */
  async sendesc(text) {
    await this.sendchr(27);
    await this.send(text);
  }

  /**
   * Beep
   */
  async bip() {
    await this.sendchr(7);
  }

  /**
   * Convert accented characters (cf STUM p 103)
   */
  accents(text) {
    text = text.replace(/à/g, "\x19\x41a");
    text = text.replace(/â/g, "\x19\x43a");
    text = text.replace(/ä/g, "\x19\x48a");
    text = text.replace(/è/g, "\x19\x41e");
    text = text.replace(/é/g, "\x19\x42e");
    text = text.replace(/ê/g, "\x19\x43e");
    text = text.replace(/ë/g, "\x19\x48e");
    text = text.replace(/î/g, "\x19\x43i");
    text = text.replace(/ï/g, "\x19\x48i");
    text = text.replace(/ô/g, "\x19\x43o");
    text = text.replace(/ö/g, "\x19\x48o");
    text = text.replace(/ù/g, "\x19\x43u");
    text = text.replace(/û/g, "\x19\x43u");
    text = text.replace(/ü/g, "\x19\x48u");
    text = text.replace(/ç/g, "\x19\x4Bc");
    text = text.replace(/°/g, "\x19\x30");
    text = text.replace(/£/g, "\x19\x23");
    text = text.replace(/Œ/g, "\x19\x6A").replace(/œ/g, "\x19\x7A");
    text = text.replace(/ß/g, "\x19\x7B");

    // Special characters
    text = text.replace(/¼/g, "\x19\x3C");
    text = text.replace(/½/g, "\x19\x3D");
    text = text.replace(/¾/g, "\x19\x3E");
    text = text.replace(/←/g, "\x19\x2C");
    text = text.replace(/↑/g, "\x19\x2D");
    text = text.replace(/→/g, "\x19\x2E");
    text = text.replace(/↓/g, "\x19\x2F");
    text = text.replace(/̶/g, "\x60");
    text = text.replace(/\|/g, "\x7C");

    // Accented characters not available on Minitel
    text = text.replace(/À/g, "A").replace(/Â/g, "A").replace(/Ä/g, "A");
    text = text.replace(/È/g, "E").replace(/É/g, "E");
    text = text.replace(/Ê/g, "E").replace(/Ë/g, "E");
    text = text.replace(/Ï/g, "I").replace(/Î/g, "I");
    text = text.replace(/Ô/g, "O").replace(/Ö/g, "O");
    text = text.replace(/Ù/g, "U").replace(/Û/g, "U").replace(/Ü/g, "U");
    text = text.replace(/Ç/g, "C");

    return text;
  }
}
