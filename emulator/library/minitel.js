"use strict";

/**
 * @file constant.js
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 *
 * Constant used for Minitel emulation
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * Number of rows on a Minitel screen, including the status row
 * @member {number}
 */
Minitel.rows = 25;

/**
 * Number of columns on a Minitel screen
 * @member {number}
 */
Minitel.columns = 40;

/**
 * Width of a Minitel character in real pixels
 * @member {number}
 */
Minitel.charWidth = 8;

/**
 * Height of a Minitel character in real pixels
 */
Minitel.charHeight = 10;

/**
 * Standard minitel speed of 300 bits per second
 * @member {number}
 */
Minitel.B300 = 300;

/**
 * Standard minitel speed of 1200 bits per second
 * @member {number}
 */
Minitel.B1200 = 1200;

/**
 * Standard minitel speed of 4800 bits per second
 * @member {number}
 */
Minitel.B4800 = 4800;

/**
 * Standard minitel speed of 9600 bits per second (only on Minitel 2 and above)
 * @member {number}
 */
Minitel.B9600 = 9600;

/**
 * List of HTML colors corresponding to Minitel grays.
 * key=Minitel color (0 to 7), value=HTML color
 * @member {string[]}
 */
Minitel.grays = [
  "#000000", // 0%
  "#7F7F7F", // 50%
  "#B2B2B2", // 70%
  "#E5E5E5", // 90%
  "#666666", // 40%
  "#999999", // 60%
  "#CCCCCC", // 80%
  "#FFFFFF", // 100%
];

/**
 * List of HTML colors corresponding to Minitel colors
 * key=Minitel color (0 to 7), value=HTML color
 * @member {string[]}
 */
Minitel.colors = [
  "#000000", // black
  "#FF0000", // red
  "#00FF00", // green
  "#FFFF00", // yellow
  "#0000FF", // blue
  "#FF00FF", // magenta
  "#00FFFF", // cyan
  "#FFFFFF", // white
];

/**
 * List of best contrast colors. Used for drawing on a specific color and still
 * be able to spot the difference.
 * key=Minitel color (0 to 7), value=Minitel opposite color (0 to 7)
 * @member {number[]}
 */
Minitel.contrasts = [7, 7, 0, 0, 7, 7, 0, 0];

/**
 * Direct correspondance between an identifier and its matching stream. Used
 * to generate Videotex stream when the generation is straightforward.
 * @member {Object.<string, number[]>}
 */
Minitel.directStream = {
  "clear-screen": [0x0c],
  "clear-status": [0x1f, 0x40, 0x41, 0x18, 0x0a],
  "clear-eol": [0x18],
  "clear-end-of-screen": [0x1b, 0x5b, 0x4a],
  "clear-start-of-screen": [0x1b, 0x5b, 0x31, 0x4a],
  "clear-start-of-line": [0x1b, 0x5b, 0x31, 0x4b],
  "clear-complete-line": [0x1b, 0x5b, 0x32, 0x4b],
  "clear-complete-screen": [0x1b, 0x5b, 0x32, 0x4a],
  "move-up": [0x0b],
  "move-down": [0x0a],
  "move-left": [0x08],
  "move-right": [0x09],
  "move-sol": [0x0d],
  "content-g0": [0x0f],
  "content-g1": [0x0e],
  "effect-underline-on": [0x1b, 0x5a],
  "effect-underline-off": [0x1b, 0x59],
  "effect-invert-on": [0x1b, 0x5d],
  "effect-invert-off": [0x1b, 0x5c],
  "effect-blink-on": [0x1b, 0x48],
  "effect-blink-off": [0x1b, 0x49],
  "effect-normal-size": [0x1b, 0x4c],
  "effect-double-height": [0x1b, 0x4d],
  "effect-double-width": [0x1b, 0x4e],
  "effect-double-size": [0x1b, 0x4f],
  "cursor-on": [0x11],
  "cursor-off": [0x14],
  "color-fg-0": [0x1b, 0x40],
  "color-fg-1": [0x1b, 0x41],
  "color-fg-2": [0x1b, 0x42],
  "color-fg-3": [0x1b, 0x43],
  "color-fg-4": [0x1b, 0x44],
  "color-fg-5": [0x1b, 0x45],
  "color-fg-6": [0x1b, 0x46],
  "color-fg-7": [0x1b, 0x47],
  "color-bg-0": [0x1b, 0x50],
  "color-bg-1": [0x1b, 0x51],
  "color-bg-2": [0x1b, 0x52],
  "color-bg-3": [0x1b, 0x53],
  "color-bg-4": [0x1b, 0x54],
  "color-bg-5": [0x1b, 0x55],
  "color-bg-6": [0x1b, 0x56],
  "color-bg-7": [0x1b, 0x57],
  "drcs-std-g0": [0x1b, 0x28, 0x40],
  "drcs-drcs-g0": [0x1b, 0x28, 0x20, 0x42],
  "drcs-std-g1": [0x1b, 0x29, 0x63],
  "drcs-drcs-g1": [0x1b, 0x29, 0x20, 0x43],
  "mask-zone-on": [0x1b, 0x58],
  "mask-zone-off": [0x1b, 0x5f],
  "mask-global-on": [0x1b, 0x23, 0x20, 0x58],
  "mask-global-off": [0x1b, 0x23, 0x20, 0x5f],
};

/**
 * List of special characters and their matching Videotex stream. The
 * associative array is indexed by the Unicode number of the character.
 * @member {Object.<number, number[]>}
 */
Minitel.specialChars = {
  163: [0x19, 0x23], // £
  176: [0x19, 0x30], // °
  177: [0x19, 0x31], // ±
  8592: [0x19, 0x2c], // ←
  8593: [0x19, 0x2d], // ↑
  8594: [0x19, 0x2e], // →
  8595: [0x19, 0x2f], // ↓
  188: [0x19, 0x3c], // ¼
  189: [0x19, 0x3d], // ½
  190: [0x19, 0x3e], // ¾
  231: [0x19, 0x4b, 0x63], // ç
  8217: [0x27], // ’
  224: [0x19, 0x41, 0x61], // à
  225: [0x19, 0x42, 0x61], // á
  226: [0x19, 0x43, 0x61], // â
  228: [0x19, 0x48, 0x61], // ä
  232: [0x19, 0x41, 0x65], // è
  233: [0x19, 0x42, 0x65], // é
  234: [0x19, 0x43, 0x65], // ê
  235: [0x19, 0x48, 0x65], // ë
  236: [0x19, 0x41, 0x69], // ì
  237: [0x19, 0x42, 0x69], // í
  238: [0x19, 0x43, 0x69], // î
  239: [0x19, 0x48, 0x69], // ï
  242: [0x19, 0x41, 0x6f], // ò
  243: [0x19, 0x42, 0x6f], // ó
  244: [0x19, 0x43, 0x6f], // ô
  246: [0x19, 0x48, 0x6f], // ö
  249: [0x19, 0x41, 0x75], // ù
  250: [0x19, 0x42, 0x75], // ú
  251: [0x19, 0x43, 0x75], // û
  252: [0x19, 0x48, 0x75], // ü
  338: [0x19, 0x6a], // Œ
  339: [0x19, 0x7a], // œ
  223: [0x19, 0x7b], // ß
  946: [0x19, 0x7b], // β
};

/**
 * List of PC to Minitel keys.
 * @member {Object.<string, string>}
 */
Minitel.pcToMinitelKeys = {
  Enter: "Envoi",
  Tab: "Suite",
  ArrowDown: "Suite",
  ArrowUp: "Retour",
  Backspace: "Correction",
  ArrowLeft: "Annulation",
  ArrowRight: "Envoi",
  Home: "Sommaire",
  Escape: "Annulation",
  F1: "Guide",
  F2: "Repetition",
};

/**
 * List of key codes used by Minitel for its keyboard.
 * @member {Object.<string, Object<string, number[]>>}
 */
Minitel.keys = {
  Videotex: {
    Escape: [0x1b],
    " ": [0x20],
    "!": [0x21],
    '"': [0x22],
    "#": [0x23],
    $: [0x24],
    "%": [0x25],
    "&": [0x26],
    "'": [0x27],
    "(": [0x28],
    ")": [0x29],
    "*": [0x2a],
    "+": [0x2b],
    ",": [0x2c],
    "-": [0x2d],
    ".": [0x2e],
    "/": [0x2f],
    0: [0x30],
    1: [0x31],
    2: [0x32],
    3: [0x33],
    4: [0x34],
    5: [0x35],
    6: [0x36],
    7: [0x37],
    8: [0x38],
    9: [0x39],
    ":": [0x3a],
    ";": [0x3b],
    "<": [0x3c],
    "=": [0x3d],
    ">": [0x3e],
    "?": [0x3f],
    "@": [0x40],
    A: [0x41],
    B: [0x42],
    C: [0x43],
    D: [0x44],
    E: [0x45],
    F: [0x46],
    G: [0x47],
    H: [0x48],
    I: [0x49],
    J: [0x4a],
    K: [0x4b],
    L: [0x4c],
    M: [0x4d],
    N: [0x4e],
    O: [0x4f],
    P: [0x50],
    Q: [0x51],
    R: [0x52],
    S: [0x53],
    T: [0x54],
    U: [0x55],
    V: [0x56],
    W: [0x57],
    X: [0x58],
    Y: [0x59],
    Z: [0x5a],
    "[": [0x5b],
    "\\": [0x5c],
    "]": [0x5d],
    "^": [0x5e],
    _: [0x5f],
    "`": [0x60],
    a: [0x61],
    b: [0x62],
    c: [0x63],
    d: [0x64],
    e: [0x65],
    f: [0x66],
    g: [0x67],
    h: [0x68],
    i: [0x69],
    j: [0x6a],
    k: [0x6b],
    l: [0x6c],
    m: [0x6d],
    n: [0x6e],
    o: [0x6f],
    p: [0x70],
    q: [0x71],
    r: [0x72],
    s: [0x73],
    t: [0x74],
    u: [0x75],
    v: [0x76],
    w: [0x77],
    x: [0x78],
    y: [0x79],
    z: [0x7a],
    "{": [0x7b],
    "|": [0x7c],
    "}": [0x7d],
    "~": [0x7e],
    DEL: [0x7f],

    Envoi: [0x13, 0x41],
    Retour: [0x13, 0x42],
    Repetition: [0x13, 0x43],
    Guide: [0x13, 0x44],
    Annulation: [0x13, 0x45],
    Sommaire: [0x13, 0x46],
    Correction: [0x13, 0x47],
    Suite: [0x13, 0x48],

    Haut: [0x1b, 0x5b, 0x41],
    MajHaut: [0x1b, 0x5b, 0x4d],
    Bas: [0x1b, 0x5b, 0x42],
    MajBas: [0x1b, 0x5b, 0x4c],
    Droite: [0x1b, 0x5b, 0x43],
    MajDroite: [0x1b, 0x5b, 0x34, 0x68], // [0x1B, 0x5B, 0x34, 0x6C]
    Gauche: [0x1b, 0x5b, 0x44],
    MajGauche: [0x1b, 0x5b, 0x50],
    CtrlGauche: [0x7f],
    Entree: [0x0d],
    MajEntree: [0x1b, 0x5b, 0x48],
    CtrlEntree: [0x1b, 0x5b, 0x32, 0x4a],

    "£": [0x19, 0x23],
    "°": [0x19, 0x30],
    "±": [0x19, 0x31],
    "←": [0x19, 0x2c],
    "↑": [0x19, 0x2d],
    "→": [0x19, 0x2e],
    "↓": [0x19, 0x2f],
    "¼": [0x19, 0x3c],
    "½": [0x19, 0x3d],
    "¾": [0x19, 0x3e],
    ç: [0x19, 0x4b, 0x63],
    "’": [0x27],
    à: [0x19, 0x41, 0x61],
    á: [0x19, 0x42, 0x61],
    â: [0x19, 0x43, 0x61],
    ä: [0x19, 0x48, 0x61],
    è: [0x19, 0x41, 0x65],
    é: [0x19, 0x42, 0x65],
    ê: [0x19, 0x43, 0x65],
    ë: [0x19, 0x48, 0x65],
    ì: [0x19, 0x41, 0x69],
    í: [0x19, 0x42, 0x69],
    î: [0x19, 0x43, 0x69],
    ï: [0x19, 0x48, 0x69],
    ò: [0x19, 0x41, 0x6f],
    ó: [0x19, 0x42, 0x6f],
    ô: [0x19, 0x43, 0x6f],
    ö: [0x19, 0x48, 0x6f],
    ù: [0x19, 0x41, 0x75],
    ú: [0x19, 0x42, 0x75],
    û: [0x19, 0x43, 0x75],
    ü: [0x19, 0x48, 0x75],
    Œ: [0x19, 0x6a],
    œ: [0x19, 0x7a],
    ß: [0x19, 0x7b],
    β: [0x19, 0x7b],
  },
  // Mode C0
  // Haut [ 0x0B ]
  // Bas [ 0x0A ]
  // Droite [ 0x09 ]
  // Gauche [ 0x08 ]
  // CtrlGauche [ 0x7F ]
  // Entree [ 0x0D ]
  // MajEntree [ 0x1E ]
  // CtrlEntree [ 0x0C ]

  // Mode téléinformatique
  // Envoi [ 0x1B, 0x4F, 0x4D ]
  // Sommaire [ 0x1B, 0x4F, 0x50 ]
  // Annulation [ 0x1B, 0x4F, 0x51 ]
  // Retour [ 0x1B, 0x4F, 0x52 ]
  // Repetition [ 0x1B, 0x4F, 0x53 ]
  // Correction [ 0x1B, 0x4F, 0x6C ]
  // Guide [ 0x1B, 0x4F, 0x6D ]
  // Suite [ 0x1B, 0x4F, 0x6E ]

  // F10 [ 0x1B, 0x4F, 0x70 ]
  // F1 [ 0x1B, 0x4F, 0x71 ]
  // F2 [ 0x1B, 0x4F, 0x72 ]
  // F3 [ 0x1B, 0x4F, 0x73 ]
  // F4 [ 0x1B, 0x4F, 0x74 ]
  // F5 [ 0x1B, 0x4F, 0x75 ]
  // F6 [ 0x1B, 0x4F, 0x76 ]
  // F7 [ 0x1B, 0x4F, 0x77 ]
  // F8 [ 0x1B, 0x4F, 0x78 ]
  // F9 [ 0x1B, 0x4F, 0x79 ]

  // Haut [ 0x1B, 0x5B, 0x41 ]
  // MajHaut [ 0x1B, 0x5B, 0x4D ]
  // Bas [ 0x1B, 0x5B, 0x42 ]
  // MajBas [ 0x1B, 0x5B, 0x4C ]
  // Droite [ 0x1B, 0x5B, 0x42 ]
  // MajDroite [ 0x1B, 0x5B, 0x34, 0x68 ] [ 0x1B, 0x5B, 0x34, 0x6C ]
  // Gauche [ 0x1B, 0x5B, 0x44 ]
  // MajGauche [ 0x1B, 0x5B, 0x50 ]
  // CtrlGauche [ 0x7F ]
  // Entree [ 0x0D ]
  // MajEntree [ 0x1B, 0x5B, 0x48 ]
  // CtrlEntree [ 0x1B, 0x5B, 0x32, 0x4A ]
};

/**
 * List of raw codes used by video chipset.
 * @member {Object<string, number>}
 */
Minitel.rawChars = {
  " ": 0x20,
  "!": 0x21,
  '"': 0x22,
  "#": 0x23,
  $: 0x24,
  "%": 0x25,
  "&": 0x26,
  "'": 0x27,
  "(": 0x28,
  ")": 0x29,
  "*": 0x2a,
  "+": 0x2b,
  ",": 0x2c,
  "-": 0x2d,
  ".": 0x2e,
  "/": 0x2f,
  0: 0x30,
  1: 0x31,
  2: 0x32,
  3: 0x33,
  4: 0x34,
  5: 0x35,
  6: 0x36,
  7: 0x37,
  8: 0x38,
  9: 0x39,
  ":": 0x3a,
  ";": 0x3b,
  "<": 0x3c,
  "=": 0x3d,
  ">": 0x3e,
  "?": 0x3f,
  "@": 0x40,
  A: 0x41,
  B: 0x42,
  C: 0x43,
  D: 0x44,
  E: 0x45,
  F: 0x46,
  G: 0x47,
  H: 0x48,
  I: 0x49,
  J: 0x4a,
  K: 0x4b,
  L: 0x4c,
  M: 0x4d,
  N: 0x4e,
  O: 0x4f,
  P: 0x50,
  Q: 0x51,
  R: 0x52,
  S: 0x53,
  T: 0x54,
  U: 0x55,
  V: 0x56,
  W: 0x57,
  X: 0x58,
  Y: 0x59,
  Z: 0x5a,
  "[": 0x5b,
  "\\": 0x5c,
  "]": 0x5d,
  "^": 0x5e,
  _: 0x5f,
  "`": 0x60,
  a: 0x61,
  b: 0x62,
  c: 0x63,
  d: 0x64,
  e: 0x65,
  f: 0x66,
  g: 0x67,
  h: 0x68,
  i: 0x69,
  j: 0x6a,
  k: 0x6b,
  l: 0x6c,
  m: 0x6d,
  n: 0x6e,
  o: 0x6f,
  p: 0x70,
  q: 0x71,
  r: 0x72,
  s: 0x73,
  t: 0x74,
  u: 0x75,
  v: 0x76,
  w: 0x77,
  x: 0x78,
  y: 0x79,
  z: 0x7a,
  "{": 0x7b,
  "|": 0x7c,
  "}": 0x7d,
  "~": 0x7e,
  "£": 0x03,
  "°": 0x10,
  "±": 0x11,
  "←": 0x0c,
  "↑": 0x5e,
  "→": 0x0e,
  "↓": 0x0f,
  "¼": 0x1c,
  "½": 0x1d,
  "¾": 0x1e,
  ç: 0x15,
  Ç: 0x05,
  "’": 0x27,
  à: 0x17,
  À: 0x07,
  á: 0x61,
  â: 0x04,
  Â: 0x01,
  ä: 0x61,
  è: 0x19,
  È: 0x09,
  é: 0x12,
  É: 0x02,
  ê: 0x1b,
  Ê: 0x0b,
  ì: 0x69,
  í: 0x69,
  î: 0x69,
  ï: 0x14,
  ò: 0x6f,
  ó: 0x6f,
  ô: 0x1f,
  ö: 0x6f,
  ù: 0x08,
  ú: 0x75,
  û: 0x16,
  ü: 0x75,
  Œ: 0x0a,
  œ: 0x1a,
  "÷": 0x18,
  "⸮": 0x00,
};

/**
 * @typedef {Object} AutomatonAction
 * @property {string} error Id indicating the error encountered
 * @property {string} notImplemented Id indicating a state not implemented
 * @property {string} func Function identifier
 * @property {string} arg Argument for the function
 * @property {string} goto Next state to go to
 * @property {number} dynarg Number of previous bytes to pass to the function
 */

/**
 * @typedef {number} VideotexByte
 */

/**
 * @typedef {string} VideotexJoker
 */

/**
 * @typedef {Object.<VideotexByte|VideotexJoker, AutomatonAction>} Transitions
 */

/**
 * @typedef {string} StateName
 */

/**
 * The automaton used to decode Videotex stream.
 * @member {Object.<StateName, Transitions>}
 */
Minitel.states = {
  start: {
    0x01: { error: "unrecognized01" },
    0x02: { error: "unrecognized02" },
    0x03: { error: "unrecognized03" },
    0x04: { error: "unrecognized04" },
    0x05: { notImplemented: "askId" },
    0x06: { error: "unrecognized06" },
    0x07: { func: "beep" },
    0x08: { func: "moveCursor", arg: "left" },
    0x09: { func: "moveCursor", arg: "right" },
    0x0a: { func: "moveCursor", arg: "down" },
    0x0b: { func: "moveCursor", arg: "up" },
    0x0c: { func: "clear", arg: "page" },
    0x0d: { func: "moveCursor", arg: "firstColumn" },
    0x0e: { func: "setCharType", arg: "G1" },
    0x0f: { func: "setCharType", arg: "G0" },
    0x10: { error: "unrecognized10" },
    0x11: { func: "showCursor", arg: true },
    0x12: { goto: "repeat" },
    0x13: { goto: "sep" },
    0x14: { func: "showCursor", arg: false },
    0x15: { error: "unrecognized15" },
    0x16: { goto: "g2" },
    0x17: { error: "unrecognized17" },
    0x18: { func: "clear", arg: "eol" },
    0x19: { goto: "g2" },
    0x1a: { func: "print", arg: 0x7f },
    0x1b: { goto: "esc" },
    0x1c: { error: "unrecognized1C" },
    0x1d: { error: "unrecognized1D" },
    0x1e: { func: "moveCursor", arg: "home" },
    0x1f: { goto: "us" },
    "*": { func: "print", dynarg: 1 },
  },

  repeat: {
    "*": { func: "repeat", dynarg: 1 },
  },

  g2: {
    0x23: { func: "print", arg: 0x03 }, // £
    0x24: { func: "print", arg: 0x24 }, // $
    0x26: { func: "print", arg: 0x23 }, // #
    0x2c: { func: "print", arg: 0x0c }, // ←
    0x2d: { func: "print", arg: 0x5e }, // ↑
    0x2e: { func: "print", arg: 0x0e }, // →
    0x2f: { func: "print", arg: 0x0f }, // ↓
    0x30: { func: "print", arg: 0x10 }, // °
    0x31: { func: "print", arg: 0x11 }, // ±
    0x38: { func: "print", arg: 0x18 }, // ÷
    0x3c: { func: "print", arg: 0x1c }, // ¼
    0x3d: { func: "print", arg: 0x1d }, // ½
    0x3e: { func: "print", arg: 0x1e }, // ¾
    0x6a: { func: "print", arg: 0x0a }, // Œ
    0x7a: { func: "print", arg: 0x1a }, // œ
    0x41: { goto: "g2grave" }, // grave
    0x42: { goto: "g2acute" }, // acute
    0x43: { goto: "g2circ" }, // circ
    0x48: { goto: "g2trema" }, // trema
    0x4b: { goto: "g2cedila" }, // cedila
    "*": { func: "print", arg: 0x5f },
  },

  g2grave: {
    0x41: { func: "print", arg: 0x07 }, // À
    0x61: { func: "print", arg: 0x17 }, // à
    0x45: { func: "print", arg: 0x09 }, // È
    0x65: { func: "print", arg: 0x19 }, // è
    0x75: { func: "print", arg: 0x08 }, // ù
    "*": { func: "print", arg: 0x5f },
  },

  g2acute: {
    0x45: { func: "print", arg: 0x02 }, // É
    0x65: { func: "print", arg: 0x12 }, // é
    "*": { func: "print", arg: 0x5f },
  },

  g2circ: {
    0x41: { func: "print", arg: 0x01 }, // Â
    0x61: { func: "print", arg: 0x04 }, // â
    0x45: { func: "print", arg: 0x0b }, // Ê
    0x65: { func: "print", arg: 0x1b }, // ê
    0x75: { func: "print", arg: 0x16 }, // û
    0x69: { func: "print", arg: 0x0d }, // î
    0x6f: { func: "print", arg: 0x1f }, // ô
    "*": { func: "print", arg: 0x5f },
  },

  g2trema: {
    0x45: { func: "print", arg: 0x06 }, // Ë
    0x65: { func: "print", arg: 0x13 }, // ë
    0x69: { func: "print", arg: 0x14 }, // ï
    "*": { func: "print", arg: 0x5f },
  },

  g2cedila: {
    0x43: { func: "print", arg: 0x05 }, // Ç
    0x63: { func: "print", arg: 0x15 }, // ç
    "*": { func: "print", arg: 0x5f },
  },

  sep: {
    "*": { notImplemented: "sepCommand" },
  },

  esc: {
    0x23: { goto: "mask-global" },
    0x28: { goto: "drcs-g0-use" },
    0x29: { goto: "drcs-g1-use" },
    0x37: { notImplemented: "saveContext" },
    0x38: { notImplemented: "restoreContext" },
    0x39: { goto: "pro1" },
    0x3a: { goto: "pro2" },
    0x3b: { goto: "pro3" },
    0x40: { func: "setFgColor", arg: 0 },
    0x41: { func: "setFgColor", arg: 1 },
    0x42: { func: "setFgColor", arg: 2 },
    0x43: { func: "setFgColor", arg: 3 },
    0x44: { func: "setFgColor", arg: 4 },
    0x45: { func: "setFgColor", arg: 5 },
    0x46: { func: "setFgColor", arg: 6 },
    0x47: { func: "setFgColor", arg: 7 },
    0x48: { func: "setBlink", arg: true },
    0x49: { func: "setBlink", arg: false },
    0x4a: { notImplemented: "setInsertOff" },
    0x4b: { notImplemented: "setInsertOn" },
    0x4c: { func: "setSize", arg: "normalSize" },
    0x4d: { func: "setSize", arg: "doubleHeight" },
    0x4e: { func: "setSize", arg: "doubleWidth" },
    0x4f: { func: "setSize", arg: "doubleSize" },
    0x50: { func: "setBgColor", arg: 0 },
    0x51: { func: "setBgColor", arg: 1 },
    0x52: { func: "setBgColor", arg: 2 },
    0x53: { func: "setBgColor", arg: 3 },
    0x54: { func: "setBgColor", arg: 4 },
    0x55: { func: "setBgColor", arg: 5 },
    0x56: { func: "setBgColor", arg: 6 },
    0x57: { func: "setBgColor", arg: 7 },
    0x58: { func: "setMask", arg: true },
    0x59: { func: "setUnderline", arg: false },
    0x5a: { func: "setUnderline", arg: true },
    0x5b: { goto: "csi" },
    0x5c: { func: "setInvert", arg: false },
    0x5d: { func: "setInvert", arg: true },
    0x5f: { func: "setMask", arg: false },
  },

  us: {
    0x23: { goto: "drcs-define" },
    "*": { goto: "us-2" },
  },
  "us-2": { "*": { func: "locate", dynarg: 2 } },

  "drcs-define": {
    0x20: { goto: "drcs-define-2" },
    "*": { func: "drcsSetStartChar", dynarg: 1, goto: "drcs-start" },
  },

  // Select charset on which some chars will be defined
  "drcs-define-2": { 0x20: { goto: "drcs-define-3" } },
  "drcs-define-3": { 0x20: { goto: "drcs-define-gselect" } },
  "drcs-define-gselect": {
    0x42: { goto: "drcs-define-validate-g0" },
    0x43: { goto: "drcs-define-validate-g1" },
  },
  "drcs-define-validate-g0": {
    0x49: { func: "drcsDefineCharset", arg: "G0" },
  },
  "drcs-define-validate-g1": {
    0x49: { func: "drcsDefineCharset", arg: "G1" },
  },

  // Define a character
  "drcs-start": { 0x30: { func: "drcsStart", goto: "drcs-read" } },
  "drcs-read": {
    0x30: { func: "drcsDefineChar", goto: "drcs-read" },
    0x1f: { func: "drcsDefineChar", goto: "us" },
    "*": { func: "drcsInc", goto: "drcs-read" },
  },

  // Select use or not of DRCS charsets
  "drcs-g0-use": {
    0x40: { func: "drcsUseG0", arg: false },
    0x20: { goto: "drcs-g0-unuse" },
  },
  "drcs-g0-unuse": { 0x42: { func: "drcsUseG0", arg: true } },

  "drcs-g1-use": {
    0x63: { func: "drcsUseG1", arg: false },
    0x20: { goto: "drcs-g1-unuse" },
  },
  "drcs-g1-unuse": { 0x43: { func: "drcsUseG1", arg: true } },

  "mask-global": {
    0x20: { goto: "mask-global-set" },
  },

  "mask-global-set": {
    0x58: { func: "setGlobalMask", arg: true },
    0x5f: { func: "setGlobalMask", arg: false },
  },

  csi: {
    0x4a: { func: "clear", arg: "endofscreen" },
    0x31: { goto: "clearStart" },
    0x32: { goto: "clearAll" },
    /*0x41: { func: "moveCursorN
        0x42: { func: "moveCursorN", arg:"", csi: },
        "*": { goto: "csi" }*/
    "*": { notImplemented: "csiSequence" },
  },

  clearStart: {
    0x4a: { func: "clear", arg: "startofscreen" },
    0x4b: { func: "clear", arg: "startofline" },
  },

  clearAll: {
    0x4a: { func: "clear", arg: "completescreen" },
    0x4b: { func: "clear", arg: "completeline" },
  },

  pro1: { "*": { notImplemented: "pro1Sequence" } },
  pro2: {
    0x69: { goto: "startFunction" },
    0x6a: { goto: "stopFunction" },
  },

  startFunction: {
    0x43: { func: "setPageMode", arg: false },
    0x45: { func: "setUppercaseMode", arg: false },
    0x46: { notImplemented: "startUpZoom" },
    0x47: { notImplemented: "startDownZoom" },
  },

  stopFunction: {
    0x43: { func: "setPageMode", arg: true },
    0x45: { func: "setUppercaseMode", arg: true },
    0x46: { notImplemented: "stopUpZoom" },
    0x47: { notImplemented: "stopDownZoom" },
  },

  pro3: {
    0x60: { goto: "pro3SwitchOff" },
    0x61: { goto: "pro3SwitchOn" },
    0x69: { goto: "pro3Start" },
    0x6a: { goto: "pro3Stop" },
    "*": { goto: "pro3-2" },
  },
  "pro3-2": { "*": { goto: "pro3-3" } },
  "pro3-3": { "*": { notImplemented: "pro3Sequence" } },

  pro3SwitchOn: {
    0x58: { goto: "switchOnToScreen" },
    "*": { goto: "pro3-3" },
  },

  pro3SwitchOff: {
    0x58: { goto: "switchOffToScreen" },
    "*": { goto: "pro3-3" },
  },

  switchOnToScreen: {
    0x51: { func: "setSwitch", arg: [true, "screen", "keyboard"] },
    "*": { notImplementend: "switchOn" },
  },

  switchOffToScreen: {
    0x51: { func: "setSwitch", arg: [false, "screen", "keyboard"] },
    "*": { notImplementend: "switchOff" },
  },

  pro3Start: {
    0x59: { goto: "startKeyboardFunction" },
    "*": { goto: "pro3-3" },
  },

  pro3Stop: {
    0x59: { goto: "stopKeyboardFunction" },
    "*": { goto: "pro3-3" },
  },

  startKeyboardFunction: {
    0x41: { func: "setExtendedKeyboard", arg: true },
    0x43: { func: "setCursorKeyboard", arg: true },
  },

  stopKeyboardFunction: {
    0x41: { func: "setExtendedKeyboard", arg: false },
    0x43: { func: "setCursorKeyboard", arg: false },
  },
};

/**
 * @file Videotex automaton
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * Class implementing an automaton to read Videotex stream. What to do with the
 * decoded stream must be implemented in a child class.
 */
Minitel.Protocol = class {
  /**
   * Create a new Protocol.
   */
  constructor() {
    /**
     * The current state of the decoder
     * @member {string}
     * @private
     */
    this.state = "start";

    /**
     * A finite stack holding the previous bytes encountered by the
     * automaton. 128 bytes should be enough for any Minitel up to Minitel 2
     * @member {FiniteStack}
     * @protected
     */
    this.previousBytes = new FiniteStack(128);
  }

  /**
   * Move the cursor at a relative position
   * This method takes into account:
   * - whether the cursor is in the status row or not
   * - whether the width or height multiplier are used
   * - the current page mode
   * - whether the cursor is at the last column
   * @param {string} direction The direction to move the cursor to, can be
   *                           char, left, right, up, down, firstColumn or
   *                           home
   * @protected
   */
  moveCursor(direction) {}

  /**
   * Clear a portion of the screen.
   * @param {string} clearRange Which part of the screen should be cleared, it
   *                            can be either page, status, eol, endofscreen,
   *                            startofscreen, startofline, completescreen or
   *                            completeline
   * @protected
   */
  clear(clearRange) {}

  /**
   * Set the current page mode
   * @param {boolean} bool true indicates the screen is in page mode while
   *                       false indicates the screen is in roll mode
   * @protected
   */
  setPageMode(bool) {}

  /**
   * Emits a beep sound
   * @protected
   */
  beep() {}

  /**
   * Set the uppercase mode of the keyboard
   * @param {boolean} bool true indicates the keyboard operates in uppercase
   *                       false indicates the keyboard operates in lowercase
   * @protected
   */
  setUppercaseMode(bool) {}

  /**
   * Set the extended mode of the keyboard
   * @param {boolean} bool true indicates the keyboard works extended
   *                       false indicates the keyboard works standard
   * @protected
   */
  setExtendedMode(bool) {}

  /**
   * Set the cursor keys of the keyboard
   * @param {boolean} bool true indicates keyboard use cursor keys
   *                       false indicates keyboard does not use cursor keys
   * @protected
   */
  setCursorKeys(bool) {}

  /**
   * Set the current character type.
   * Doing so resets some attributes even if the current character type does
   * not change.
   * @param {string} charPage either G0 or G1
   * @protected
   */
  setCharType(charPage) {}

  /**
   * Sets the cursor visibility
   * @param {boolean} visibility true for a visibile cursor, false otherwise
   * @protected
   */
  showCursor(visibility) {}

  /**
   * Sets the foreground color
   * @param {number} color the foreground color (0 to 7)
   * @protected
   */
  setFgColor(color) {}

  /**
   * Sets the background color
   * @param {number} color the background color (0 to 7)
   * @protected
   */
  setBgColor(color) {}

  /**
   * Sets the character size.
   * This is valid only for alphanumerical character and when not in the
   * status row.
   * @param {string} sizeName the size can be either: normalSize, doubleWidth,
   *                          doubleHeight or doubleSize.
   * @protected
   */
  setSize(sizeName) {}

  /**
   * Sets the text blinking
   * @param {boolean} blink true for blinking text, false otherwise
   * @protected
   */
  setBlink(blink) {}

  /**
   * Sets the masking of attributes
   * @param {boolean} mask true for attributes masking, false otherwise
   * @protected
   */
  setMask(mask) {}

  /**
   * Enables or disables the use of zone masking
   * @param {boolean} enabled true enables the use of zone masking, false
   *                          disables the use of zone masking
   * @protected
   */
  setGlobalMask(enabled) {}

  /**
   * Set underline of text or separation of mosaic characters
   * @param {boolean} underline true for text underlining, false otherwise
   * @protected
   */
  setUnderline(underline) {}

  /**
   * Set video inversion of alphanumerical characters
   * @param {boolean} invert true for video inverse, false otherwise
   * @protected
   */
  setInvert(invert) {}

  /**
   * Move the cursor at an absolute position.
   * Doing so resets the current attributes.
   * @param {boolean} invert true for video inverse, false otherwise
   * @protected
   */
  locate(y, x) {}

  /**
   * Prints a delimiter at the current cursor position.
   * Printing a delimiter will apply the waiting attributes.
   * @param {number} charCode the delimiter code to print (usually 0x20)
   * @protected
   */
  printDelimiter(charCode) {}

  /**
   * Prints a G0 character.
   * G0 characters are standard alphanumerical characters.
   * @param {number} charCode the character code of the character to print
   * @protected
   */
  printG0Char(charCode) {}

  /**
   * Prints a G1 character.
   * G1 characters are semigraphic characters (mosaic).
   * @param {number} charCode the character code of the character to print
   * @protected
   */
  printG1Char(charCode) {}

  /**
   * Prints a character and moves the cursor.
   * @param {number} charCode the character code of the character to print
   * @protected
   */
  print(charCode) {}

  /**
   * Repeat the last printed character.
   * @param {number} count the number of repetitions
   * @protected
   */
  repeat(count) {}

  /**
   * Set the charset to define
   * @param {string} charsetToDefine charset to define, "G0" or "G1"
   * @protected
   */
  drcsDefineCharset(charset) {}

  /**
   * Set the ordinal number of the first character to redefine
   * @param {number} startChar starting character (ord) to define
   * @protected
   */
  drcsSetStartChar(startChar) {}

  /**
   * Start a new serie of redefinition bytes
   * @protected
   */
  drcsStart() {}

  /**
   * Increment the count of redefinition bytes
   * @protected
   */
  drcsInc() {}

  /**
   * Redefine one character based on previous redefinition bytes
   * @protected
   */
  drcsDefineChar() {}

  /**
   * Sets the character set used for G0
   * @param {boolean} bool true for the DRCS set, false for the standard set
   * @protected
   */
  drcsUseG0(bool) {}

  /**
   * Sets the character set used for G1
   * @param {boolean} bool true for the DRCS set, false for the standard set
   * @protected
   */
  drcsUseG1(bool) {}

  /**
   * Enable the extended keyboard
   * @param {boolean} bool true to enable, false to disable.
   * @protected
   */
  setExtendedKeyboard(bool) {}

  /**
   * Change the handling of cursor keys
   * @param {boolean} bool true to use C0, false to use standard codes.
   * @protected
   */
  setCursorKeyboard(bool) {}

  /**
   * Set switch between two part of the Minitel architecture.
   * @param {boolean} switchOn true to enable, false to disable.
   * @param {string} destination may be only "screen" for the moment.
   * @param {string} source may be only "keyboard" for the moment.
   * @protected
   */
  setSwitch(switchOn, destination, source) {}

  /**
   * Execute one character in the automaton
   * @param {string} char the character to execute
   * @private
   */
  decode(char) {
    // Get the ordinal value of the character
    const c = char.charCodeAt(0);

    // NUL character is always ignored, whenever it happens
    if (c === 0x00) return;

    // Keep memory of each executed character
    this.previousBytes.push(c);

    // Verify that the current state exists in the automaton
    if (!(this.state in Minitel.states)) {
      // Error! Restart at the initial state of the automaton
      console.log("Unknown state: " + this.state);
      this.state = "start";
      return;
    }

    // Look for an action for the character to execute
    let action = null;
    if (c in Minitel.states[this.state]) {
      // Found an action for this specific character
      action = Minitel.states[this.state][c];
    } else if ("*" in Minitel.states[this.state]) {
      // A generic action has been found
      action = Minitel.states[this.state]["*"];
    }

    if (action === null) {
      // The automaton does not know what to do with the character
      console.log("unexpectedChar: " + c);
    } else if ("notImplemented" in action) {
      // The automaton recognizes the character but has no action for it
      console.log("Not implemented: " + action.notImplemented);
    } else if ("error" in action) {
      // The character should not have occured at this particuliar moment
      // in the stream
      console.log("Error: " + action.error);
    } else if ("func" in action && !(action.func in this)) {
      // The automaton is fine but the specified function has not been
      // written in the MinitelDecoder class
      console.log("Error: developer forgot to write " + action.func);
    } else if ("func" in action) {
      // The action has a function ready to be executed
      let args = [];
      if ("arg" in action) {
        // The function has predefined arguments
        if (Array.isArray(action.arg)) {
          args = action.arg;
        } else {
          args = [action.arg];
        }
      } else if ("dynarg" in action) {
        // The function should take its arguments in the previously
        // executed characters
        args = this.previousBytes.lastValues(action.dynarg);
      }

      // Excute the function
      this[action.func].apply(this, args);
    }

    // Determine the next state of the automaton based on the existence of
    // a "goto" attribute, otherwise it sets the automaton to its initial
    // state.
    this.state = action && "goto" in action ? action.goto : "start";
  }

  /**
   * Decode a list of characters
   * @param {mixed} items Either a string, an instance of a String or anything
   *                      iterable containing numbers
   */
  decodeList(items) {
    if (typeof items === "string" || items instanceof String) {
      // Items are a string of an instance of a String
      range(items.length).forEach((i) => this.decode(items[i]));
    } else {
      // Items are iterable
      range(items.length).forEach((i) =>
        this.decode(String.fromCharCode(items[i]))
      );
    }
  }
};

/**
 * @file elements.js
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 *
 * A class to facilitate search of HTML elements needed for the Minitel
 * emulator.
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * @class Elements
 */
Minitel.Elements = class {
  /**
   * Initializes an element to undefined.
   * @param {string} elementName The name of the element to add.
   * @return {Minitel.Elements}
   */
  add(elementName) {
    this[elementName] = undefined;

    return this;
  }

  /**
   * Look for each element of our object in an HTMLElement.
   *
   * @param {HTMLElement} container The HTMLElement to look from.
   * @return {Minitel.Elements}
   */
  foundIn(container) {
    for (let element in this) {
      if (!this.hasOwnProperty(element)) continue;

      this[element] =
        container.querySelector('[data-minitel="' + element + '"]') ||
        undefined;
    }

    return this;
  }
};

/**
 * @file text-grid.js
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * TextGrid is a simple class used to describe the dimensions of a text grid.
 */
Minitel.TextGrid = class {
  /**
   * @param {int} cols Number of characters per width.
   * @param {int} rows Number of characters per height.
   */
  constructor(cols, rows) {
    /**
     * Number of characters per width.
     * @member {string}
     */
    this.cols = cols;

    /**
     * Number of characters per height.
     * @member {string}
     */
    this.rows = rows;
  }

  /**
   * Returns a copy of the Text Grid.
   * @return {Minitel.TextGrid} a copy of the Text Grid
   */
  copy() {
    return new Minitel.TextGrid(this.cols, this.rows);
  }
};

/**
 * @file char-size.js
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * CharSize is a simple class used to describe the dimensions of a character.
 */
Minitel.CharSize = class {
  /**
   * @param {int} width Width in pixels of a character.
   * @param {int} height Height in pixels of a character.
   */
  constructor(width, height) {
    /**
     * Width in pixels of a character.
     * @member {int}
     */
    this.width = width;

    /**
     * Height in pixels of a character.
     * @member {int}
     */
    this.height = height;
  }

  /**
   * Returns a copy of the Char Size.
   * @return {Minitel.CharSize} a copy of the Char Size
   */
  copy() {
    return new Minitel.CharSize(this.width, this.height);
  }
};

/**
 * @file font-sprite
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 *
 * FontSprite uses a sprite sheet (usually a PNG image) to print characters
 * on a canvas. It handles colors.
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * @typedef {Object} Point
 * @property {number} x The X Coordinate
 * @property {number} y The Y Coordinate
 */

/**
 * @typedef {Object} Grid
 * @property {number} cols Number of characters per width.
 * @property {number} rows Number of characters per height.
 */

/**
 * @typedef {Object} Char
 * @property {number} width Width in pixels of a character.
 * @property {number} height Height in pixels of a character.
 */

/**
 * A FontSprite is a facility which draws bitmap characters on a canvas based
 * on a sprite map, a PNG image with white pixels and background transparency.
 */
Minitel.FontSprite = class {
  /**
   * Create a FontSprite.
   * @param {string} sheetURL The URL of the sprite sheet to use.
   * @param {Grid} grid How the sprite sheet is organized.
   * @param {Char} char Character characteristics.
   */
  constructor(sheetURL, grid, char) {
    /**
     * How the sprite sheet is organized.
     * @member {Grid}
     */
    this.grid = grid;

    /**
     * Character characteristics.
     * @member {Char}
     */
    this.char = char;

    /**
     * Whether sprites are rendered in color or black and white
     * @member {boolean}
     */
    this.color = true;

    /**
     * The pre-renderd sprite sheets for each color.
     * @member {HTMLCanvasElement[]}
     * @private
     */
    this.spriteSheetColors = { gray: [], color: [] };

    /**
     * Coordinates are pre-computed.
     * @member
     * @private
     */
    this.allCoordinates = [];

    /**
     * How many sprites.
     * @member {number}
     * @private
     */
    this.spriteNumber = 0;

    /**
     * Indicates whether the sprite sheet can be used or not.
     * @member {boolean}
     */
    this.isReady = false;

    // Load the source sprite sheet, optimization will occur when loaded
    this.spriteSheet = new Image();
    this.spriteSheet.onload = () => this.generateColors();
    this.spriteSheet.src = sheetURL;
  }

  /**
   * Generates a sprite sheet for each available color, speeding up the
   * rendering.
   * @private
   */
  generateColors() {
    function generateColor(source, color) {
      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;

      const ctx = canvas.getContext("2d");
      const [width, height] = [canvas.width, canvas.height];

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(source, 0, 0, width, height, 0, 0, width, height);
      ctx.fillStyle = color;
      ctx.globalCompositeOperation = "source-in";
      ctx.fillRect(0, 0, width, height);

      return canvas;
    }

    this.spriteSheetColors.color = Minitel.colors.map((color) =>
      generateColor(this.spriteSheet, color)
    );

    this.spriteSheetColors.gray = Minitel.grays.map((gray) =>
      generateColor(this.spriteSheet, gray)
    );

    this.generateCoordinates();

    this.isReady = true;
  }

  /**
   * Pre-computes all coordinates
   *
   * @private
   */
  generateCoordinates() {
    this.spriteNumber = this.grid.cols * this.grid.rows;

    range(this.spriteNumber).forEach((ord) => {
      this.allCoordinates.push({
        x: Math.floor(ord / this.grid.rows) * this.char.width,
        y: (ord % this.grid.rows) * this.char.height,
      });
    });
  }

  /**
   * Converts a character ordinal to its position in the sprite sheet. An
   * out of range ordinal will be considered like the last available
   * character.
   *
   * @param {number} ord The ordinal of the character
   * @return {Point} The position of the character in the sprite sheet
   * @private
   */
  toCoordinates(ord) {
    if (ord < 0 || ord >= this.grid.cols * this.grid.rows) {
      ord = this.grid.cols * this.grid.rows - 1;
    }

    return this.allCoordinates[ord];
  }

  /**
   * @param {CanvasRenderingContext2D} ctx Context used for drawing
   * @param {number} ord Character ordinal
   * @param {number} x Destination x coordinate
   * @param {number} y Destination y coordinate
   * @param {Object} part Part of the character (when doubling is used)
   * @param {number} part.x 0=left part
   * @param {number} part.y 0=bottom part
   * @param {Object} mult
   * @param {number} mult.width Width multiplier
   * @param {number} mult.height Height multiplier
   * @param {number} color Index of the color to use as character foreground
   * @param {boolean} underline true if a line must be drawn on the bottom
   *                            of the character, false otherwise
   */
  writeChar(ctx, ord, x, y, part, mult, color, underline) {
    if (ord < 0 || ord >= this.spriteNumber) ord = this.spriteNumber - 1;
    const srcCoords = this.allCoordinates[ord];

    const offset = {
      x: Math.floor((part.x * this.char.width) / mult.width),
      y: Math.floor((part.y * this.char.height) / mult.height),
    };

    if (color === undefined) color = 0;

    const source = this.color
      ? this.spriteSheetColors.color[color]
      : this.spriteSheetColors.gray[color];

    ctx.save();

    // Create clipping
    ctx.beginPath();
    ctx.rect(x, y, this.char.width, this.char.height);
    ctx.clip();

    if (mult.height === 2) {
      // When height is doubled, first line is three pixel height and
      // last line is one pixel height
      if (part.y === 0) {
        ctx.drawImage(
          // Source
          source,
          srcCoords.x + offset.x,
          srcCoords.y + offset.y,
          this.char.width / mult.width,
          1 / mult.height,

          // Destination
          x,
          y,
          this.char.width,
          1
        );

        ctx.drawImage(
          // Source
          source,
          srcCoords.x + offset.x,
          srcCoords.y + offset.y,
          this.char.width / mult.width,
          this.char.height / mult.height,

          // Destination
          x,
          y + 1,
          this.char.width,
          this.char.height
        );
      } else {
        ctx.drawImage(
          // Source
          source,
          srcCoords.x + offset.x,
          srcCoords.y + offset.y - 1,
          this.char.width / mult.width,
          1 / mult.height,

          // Destination
          x,
          y,
          this.char.width,
          1
        );

        ctx.drawImage(
          // Source
          source,
          srcCoords.x + offset.x,
          srcCoords.y + offset.y,
          this.char.width / mult.width,
          this.char.height / mult.height,

          // Destination
          x,
          y + 1,
          this.char.width,
          this.char.height
        );
      }
    } else {
      // Generic case
      ctx.drawImage(
        // Source
        source,
        srcCoords.x + offset.x,
        srcCoords.y + offset.y,
        this.char.width / mult.width,
        this.char.height / mult.height,

        // Destination
        x,
        y,
        this.char.width,
        this.char.height
      );
    }

    // Draw the underline if needed
    if (underline && part.y === mult.height - 1) {
      ctx.fillStyle = this.color ? Minitel.colors[color] : Minitel.grays[color];

      ctx.fillRect(x, y + this.char.height - 1, this.char.width, 1);
    }

    ctx.restore();
  }

  /**
   * Redefine a character (DRCS)
   * @param {number} ord Character ordinal
   * @param {number[]} design An array of 10 bytes defining the character, one
   *                          byte corresponding to 8 pixels of a line.
   */
  defineChar(ord, design) {
    if (ord <= 32 || ord >= 127) return;
    if (design.length !== 10) return;

    const coords = this.toCoordinates(ord);

    const defineOneChar = (spriteSheetColor, color) => {
      const ctx = spriteSheetColor.getContext("2d");
      ctx.globalCompositeOperation = "source-over";

      ctx.clearRect(coords.x, coords.y, this.char.width, this.char.height);

      ctx.fillStyle = color;
      design.forEach((byte, offsetY) => {
        byte = byte & 0xff;

        range(8).forEach((bitPosition) => {
          if (byte & (1 << (7 - bitPosition))) {
            ctx.fillRect(coords.x + bitPosition, coords.y + offsetY, 1, 1);
          }
        });
      });
    };

    this.spriteSheetColors.color.forEach((spriteSheetColor, index) => {
      defineOneChar(spriteSheetColor, Minitel.colors[index]);
    });

    this.spriteSheetColors.gray.forEach((spriteSheetColor, index) => {
      defineOneChar(spriteSheetColor, Minitel.grays[index]);
    });
  }
};

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * A Cell contains one character and its visual attributes.
 *
 * @abstract
 */
Minitel.Cell = class {
  /**
   * Create a Cell.
   *
   * @param {number} value the character ordinal number
   * @param {number} fgColor the foreground color (0 to 7)
   * @constructor
   */
  constructor(value, fgColor) {
    /**
     * The character ordinal number
     * @member {number}
     */
    this.value = value;

    /**
     * The foreground color (0 to 7)
     * @member {number}
     */
    this.fgColor = fgColor;
  }

  /**
   * Returns a copy of the Cell.
   * This method must be implemented by the children of this class
   * @return {Cell} a copy of the cell
   * @abstract
   */
  copy() {
    return new Minitel.Cell(this.value, this.fgColor);
  }

  /**
   * Returns a string version of the Cell.
   * This method must be implemented by the children of this class
   * @return {string} the string version.
   * @abstract
   */
  toString() {
    return "";
  }

  /**
   * Import cell's data from a string.
   * @param {string} image String to parse.
   * @abstract
   */
  fromString() {
    this.value = 0x20;
  }
};

/**
 * A CharCell is a particular Cell which holds alphanumerical characters.
 * Such characters only have blink, invert, size multiplier and DRCS
 * attributes.
 * @extends Cell
 */
Minitel.CharCell = class extends Minitel.Cell {
  /**
   * Create a CharCell.
   *
   * The CharCell is initialized with the following values:
   *
   * - character code set to 0x20 (a space)
   * - foreground color set to 7 (white)
   * - no blinking
   * - no video inverse
   * - no size multiplying
   * - not using DRCS
   */
  constructor() {
    super(0x20, 7);

    /**
     * Does the character blink?
     * @member {boolean}
     */
    this.blink = false;

    /**
     * Is the character displayed with foreground and background colors
     * inverted
     * @member {boolean}
     */
    this.invert = false;

    /**
     * Character size multiplier
     * @member {object}
     * @property {number} width width multiplier (1 or 2)
     * @property {number} height height multiplier (1 or 2)
     */
    this.mult = { width: 1, height: 1 };

    /**
     * Character part to be displayed.
     * @member {object}
     * @property {number} x X part to display (0 for left, 1 for right)
     * @property {number} y Y part to display (0 for bottom, 1 top)
     */
    this.part = { x: 0, y: 0 };

    /**
     * Whether the DRCS version of the character should by displayed or not
     * @member {boolean}
     */
    this.drcs = false;

    Object.preventExtensions(this);
  }

  /**
   * Tests if the character in the cell is alphanumeric (true) or not (false).
   * @return {boolean}
   */
  isAlphanumerical() {
    return (
      (this.value >= 0x41 && this.value <= 0x5a) || // A-Z
      (this.value >= 0x61 && this.value <= 0x7a) || // a-z
      (this.value >= 0x30 && this.value <= 0x39)
    ); // 0-9
  }

  /**
   * Verify that two cells have the same attributes values (true) or not
   * (false).
   * @param {CharCell} cell
   * @return {boolean}
   */
  hasSameAttributes(cell) {
    return (
      cell.fgColor === this.fgColor &&
      cell.blink === this.blink &&
      cell.invert === this.invert &&
      cell.mult.width === this.mult.width &&
      cell.mult.height === this.mult.height &&
      cell.part.x === this.part.x &&
      cell.part.y === this.part.y &&
      cell.drcs === this.drcs
    );
  }

  /**
   * Tells if the cell is the upper part of a character.
   *
   * @returns {boolean}
   */
  upperPart() {
    return Minitel.Cell.upperPart(this.mult, this.part);
  }

  /**
   * Tells if the cell is the root part of a character.
   *
   * @returns {boolean}
   */
  rootPart() {
    return Minitel.Cell.rootPart(this.mult, this.part);
  }

  /**
   * Returns a copy of the CharCell.
   * @return {CharCell} a copy of the CharCell
   */
  copy() {
    const cell = new Minitel.CharCell();

    cell.value = this.value;

    cell.fgColor = this.fgColor;
    cell.blink = this.blink;
    cell.invert = this.invert;
    cell.mult = { width: this.mult.width, height: this.mult.height };
    cell.part = { x: this.part.x, y: this.part.y };
    cell.drcs = this.drcs;

    return cell;
  }

  /**
   * Returns a string version of the Cell.
   * This method must be implemented by the children of this class
   * @return {string} the string version.
   */
  toString() {
    return (
      "C" +
      this.value.toString(16).padStart(2, "0") +
      this.fgColor.toString() +
      (this.blink ? "1" : "0") +
      (this.invert ? "1" : "0") +
      this.mult.width.toString() +
      this.mult.height.toString() +
      this.part.x.toString() +
      this.part.y.toString() +
      (this.drcs ? "1" : "0")
    );
  }

  /**
   * Import cell's data from a string.
   * @param {string} image String to parse.
   * @abstract
   */
  fromString(image) {
    if (image.substr(0, 1) !== "C") return false;
    if (image.length !== 11) return false;

    this.value = parseInt(image.substr(1, 2), 16);
    this.fgColor = parseInt(image.substr(3, 1));
    this.blink = image.substr(4, 1) === "1";
    this.invert = image.substr(5, 1) === "1";
    this.mult.width = parseInt(image.substr(6, 1));
    this.mult.height = parseInt(image.substr(7, 1));
    this.part.x = parseInt(image.substr(8, 1));
    this.part.y = parseInt(image.substr(9, 1));
    this.drcs = image.substr(10, 1) === "1";
  }
};

/**
 * A MosaicCell is a particular Cell which holds mosaic characters.
 * Such characters only have background color, blink, separation and DRCS
 * attributes.
 * @extends Cell
 */
Minitel.MosaicCell = class extends Minitel.Cell {
  /**
   * Create a MosaicCell with the following attributes:
   *
   * - character code set to 0x40
   * - background color set to 0 (black)
   * - no blinking
   * - no separation
   * - not using DRCS
   */
  constructor() {
    super(0x40, 7);

    /**
     * The background color (0 to 7)
     * @member {number}
     */
    this.bgColor = 0;

    /**
     * Does the character blink?
     * @member {boolean}
     */
    this.blink = false;

    /**
     * Whether the separated version of the character should by displayed or
     * not
     * @member {boolean}
     */
    this.separated = false;

    /**
     * Whether the DRCS version of the character should by displayed or not
     * @member {boolean}
     */
    this.drcs = false;

    Object.preventExtensions(this);
  }

  /**
   * Returns a copy of the MosaicCell.
   * @return {MosaicCell} a copy of the MosaicCell
   */
  copy() {
    const cell = new Minitel.MosaicCell();

    cell.value = this.value;

    cell.fgColor = this.fgColor;
    cell.bgColor = this.bgColor;
    cell.blink = this.blink;
    cell.separated = this.separated;
    cell.drcs = this.drcs;

    return cell;
  }

  /**
   * Returns a string version of the Cell.
   * This method must be implemented by the children of this class
   * @return {string} the string version.
   */
  toString() {
    return (
      "M" +
      this.value.toString(16).padStart(2, "0") +
      this.fgColor.toString() +
      this.bgColor.toString() +
      (this.blink ? "1" : "0") +
      (this.separated ? "1" : "0") +
      (this.drcs ? "1" : "0")
    );
  }

  /**
   * Import cell's data from a string.
   * @param {string} image String to parse.
   * @abstract
   */
  fromString(image) {
    if (image.substr(0, 1) !== "M") return false;
    if (image.length !== 8) return false;

    this.value = parseInt(image.substr(1, 2), 16);
    this.fgColor = parseInt(image.substr(3, 1));
    this.bgColor = parseInt(image.substr(4, 1));
    this.blink = image.substr(5, 1) === "1";
    this.separated = image.substr(6, 1) === "1";
    this.drcs = image.substr(7, 1) === "1";
  }
};

/**
 * A DelimiterCell is a particular Cell which contains a delimiter character.
 * Such characters only have background color, invertion, underlining, masking,
 * and size multiplier attributes.
 *
 * A DelimiterCell is an empty "character".
 *
 * They generally contains attributes that CharacterCell characters cannot
 * contain such as background color, masking or underlining.
 * @extends Cell
 */
Minitel.DelimiterCell = class extends Minitel.Cell {
  /**
   * Create a DelimiterCell with the following attributes:
   *
   * - character code set to 0x20 (a space)
   * - foregorund color set to 7 (white)
   * - background color set to 0 (black)
   * - no video inverse
   * - no underlining
   * - no masking
   * - no size multiplier
   */
  constructor() {
    super(0x20, 7);

    /**
     * The background color (0 to 7)
     * @member {number}
     */
    this.bgColor = 0;

    /**
     * Is the character displayed with foreground and background colors
     * inverted
     * @member {boolean}
     */
    this.invert = false;

    /**
     * Does the delimiter annonciate an underlined zone?
     * @member {boolean=}
     */
    this.zoneUnderline = undefined;

    /**
     * Are attributes masked?
     * @member {boolean=}
     */
    this.mask = undefined;

    /**
     * Character size multiplier
     * @member {object}
     * @property {number} width width multiplier (1 or 2)
     * @property {number} height height multiplier (1 or 2)
     */
    this.mult = { width: 1, height: 1 };

    Object.preventExtensions(this);
  }

  /**
   * Tells if the cell is the upper part of a character.
   *
   * @returns {boolean}
   */
  upperPart() {
    return Minitel.Cell.upperPart(this.mult, this.part);
  }

  /**
   * Tells if the cell is the root part of a character.
   *
   * @returns {boolean}
   */
  rootPart() {
    return Minitel.Cell.rootPart(this.mult, this.part);
  }

  /**
   * Returns a copy of the DelimiterCell.
   * @return {DelimiterCell} a copy of the DelimiterCell
   */
  copy() {
    const cell = new Minitel.DelimiterCell();

    cell.value = this.value;

    cell.fgColor = this.fgColor;
    cell.bgColor = this.bgColor;
    cell.invert = this.invert;
    cell.zoneUnderline = this.zoneUnderline;
    cell.mask = this.mask;
    cell.mult = { width: this.mult.width, height: this.mult.height };

    return cell;
  }

  /**
   * Returns a string version of the Cell.
   * This method must be implemented by the children of this class
   * @return {string} the string version.
   */
  toString() {
    return (
      "D" +
      this.value.toString(16).padStart(2, "0") +
      this.fgColor.toString() +
      this.bgColor.toString() +
      (this.invert ? "1" : "0") +
      (this.zoneUnderline ? "1" : "0") +
      (this.mask ? "1" : "0") +
      this.mult.width.toString() +
      this.mult.height.toString()
    );
  }

  /**
   * Import cell's data from a string.
   * @param {string} image String to parse.
   * @abstract
   */
  fromString(image) {
    if (image.substr(0, 1) !== "D") return false;
    if (image.length !== 10) return false;

    this.value = parseInt(image.substr(1, 2), 16);
    this.fgColor = parseInt(image.substr(3, 1));
    this.bgColor = parseInt(image.substr(4, 1));
    this.invert = image.substr(5, 1) === "1";
    this.zoneUnderline = image.substr(6, 1) === "1";
    this.mask = image.substr(7, 1) === "1";
    this.mult.width = parseInt(image.substr(8, 1));
    this.mult.height = parseInt(image.substr(9, 1));
  }
};

/**
 * Parse a string into a Cell. Automatically determines which class to use.
 *
 * @param {string} image String to parse into a Cell.
 * @returns {Minitel.Cell}
 */
Minitel.Cell.fromString = function (image) {
  let cell;
  if (image.substr(0, 1) === "C") {
    cell = new Minitel.CharCell();
  } else if (image.substr(0, 1) === "M") {
    cell = new Minitel.MosaicCell();
  } else {
    cell = new Minitel.DelimiterCell();
  }

  cell.fromString(image);

  return cell;
};

/**
 * Tells if the mult and part objects points to the upper part of a character.
 *
 * @param {Object} mult The mult object of a CharCell or DelimiterCell.
 * @param {Object} part The part object of a CharCell or DelimiterCell.
 * @returns {boolean}
 */
Minitel.Cell.upperPart = function (mult, part) {
  return mult.height > 1 && part.y === 0;
};

/**
 * Tells if the mult and part objects points to the root part of a character.
 *
 * @param {Object} mult The mult object of a CharCell or DelimiterCell.
 * @param {Object} part The part object of a CharCell or DelimiterCell.
 * @returns {boolean}
 */
Minitel.Cell.rootPart = function (mult, part) {
  return (
    part.x === 0 &&
    ((mult.height > 1 && part.y === 1) || (mult.height === 1 && part.y === 0))
  );
};

/**
 * @file vram
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 *
 * VRAM simulates video memory for the VDU class.
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * PageMemory is a rendering of a page memory in a canvas
 */
Minitel.VRAM = class {
  /**
   * @param {Minitel.TextGrid} grid How the page is organized.
   */
  constructor(grid) {
    /**
     * @member {Grid}
     * @private
     */
    this.grid = grid;

    /**
     * A two dimension array of Cells
     * @member {Cell[][]}
     */
    this.memory = [];

    // Initializes the page memory with default mosaic cells
    range(0, this.grid.rows).forEach((j) => {
      let row = [];
      range(0, this.grid.cols).forEach((i) => {
        row[i] = new Minitel.MosaicCell();
      });
      this.memory[j] = row;
    });
  }

  /**
   * Set the Cell at (X, Y) position in video memory
   *
   * @param {number} x X position of the cell
   * @param {number} y Y position of the cell
   * @param {Cell} cell The cell
   */
  set(x, y, cell) {
    this.memory[y][x] = cell;
  }

  /**
   * Get the Cell at (X, Y) position in video memory. If only one parameter
   * is given, it returns the entire row selected by this parameter.
   *
   * @param {number} x X position of the cell
   * @param {number?} y Y position of the cell
   * @return {Cell} The cell
   */
  get(x, y) {
    if (y === undefined) {
      return this.memory[x];
    } else {
      return this.memory[y][x];
    }
  }

  /**
   * Clear the page
   */
  clear() {
    range(1, this.grid.rows).forEach((y) => {
      range(0, this.grid.cols).forEach((x) => {
        this.memory[y][x] = new Minitel.MosaicCell();
      });
    });
  }

  /**
   * Scroll the page memory in a direction. It takes the page mode into
   * account.
   * @param {string} direction "up" or "down"
   */
  scroll(direction) {
    const newRow = new Array(this.grid.cols);
    range(0, this.grid.cols).forEach((col) => {
      newRow[col] = new Minitel.MosaicCell();
    });

    if (direction === "up") {
      range(1, this.grid.rows).forEach((row) => {
        this.memory[row] = this.memory[row + 1];
      });

      this.memory[this.grid.rows - 1] = newRow;
    } else if (direction === "down") {
      range(this.grid.rows - 1, 1).forEach((row) => {
        this.memory[row] = this.memory[row - 1];
      });

      this.memory[1] = newRow;
    }
  }

  /**
   * Get the word at a specific point
   * @param {int} col Column of a character in the vram
   * @param {int} row Row of a charcter in the vram
   */
  getWordAt(col, row) {
    // Ensures coordinates are valid
    if (col < 0 || col >= this.grid.cols) return "";
    if (row < 0 || row >= this.grid.rows) return "";

    // A word cannot be retrieved from anything else than a CharCell
    const origin = this.memory[row][col];
    if (!(origin instanceof Minitel.CharCell)) return "";
    if (!origin.isAlphanumerical()) return "";

    // Find the first readable character on the left
    let first = col - 1;
    while (
      first >= 0 &&
      this.memory[row][first] instanceof Minitel.CharCell &&
      this.memory[row][first].hasSameAttributes(origin) &&
      this.memory[row][first].isAlphanumerical()
    )
      first--;

    // Find the last readable character on the right
    let last = col + 1;
    while (
      last < this.grid.cols &&
      this.memory[row][last] instanceof Minitel.CharCell &&
      this.memory[row][last].hasSameAttributes(origin) &&
      this.memory[row][last].isAlphanumerical()
    )
      last++;

    // Concat each character from first to last
    let string = "";
    this.memory[row].slice(first + 1, last).forEach((cell) => {
      string += String.fromCharCode(cell.value);
    });

    return string;
  }

  /**
   * Load VRAM from a string.
   *
   * @param {string} screen The string from which to extract data.
   * @param {number?} col Starting column
   * @param {number?} row Starting row
   * @param {number?} width Width in characters
   * @param {number?} height Height in characters
   */
  load(screen, col, row, width, height) {
    if (screen === null || screen === undefined) return;

    const sizes = { C: 11, M: 8, D: 10 };
    let offset = 0;

    // Handles optional values
    col = col || 0;
    row = row || 1;
    width = width || this.grid.cols;
    height = height || this.grid.rows - row;

    range(row, row + height).forEach((y) => {
      range(col, col + width).forEach((x) => {
        const cellType = screen.substr(offset, 1);

        if (!(cellType in sizes)) {
          throw new SyntaxError(
            "Unknown cell type " + cellType + " @" + offset
          );
        }

        if (x < this.grid.cols && y < this.grid.rows) {
          this.set(
            x,
            y,
            Minitel.Cell.fromString(screen.substr(offset, sizes[cellType]))
          );
        }

        offset += sizes[cellType];
      });
    });
  }

  /**
   * Save the VRAM into a string.
   *
   * @param {number?} col Starting column
   * @param {number?} row Starting row
   * @param {number?} width Width in characters
   * @param {number?} height Height in characters
   */
  save(col, row, width, height) {
    let save = "";

    // Handles optional values
    col = col || 0;
    row = row || 1;
    width = width || this.grid.cols;
    height = height || this.grid.rows - row;

    range(row, row + height).forEach((y) => {
      range(col, col + width).forEach((x) => {
        save += this.memory[y][x].toString();
      });
    });

    return save;
  }
};

/**
 * @file vdu-cursor.js
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * A callback that is called for a position.
 * @callback execForXY
 * @param {int} X position.
 * @param {int} Y position.
 */

/**
 * VDUCursor simulates a blinking cursor on a canvas.
 */
Minitel.VDUCursor = class {
  /**
   * @param {Minitel.TextGrid} grid The text grid.
   * @param {Minitel.CharSize} char The char size.
   * @param {HTMLCanvasElement} cancur Canvas displaying the cursor.
   */
  constructor(grid, char, cancur) {
    const frameRate = 50;

    /**
     * The text grid.
     *
     * @member {Minitel.TextGrid}
     */
    this.grid = grid;

    /**
     * The char size.
     *
     * @member {Minitel.CharSize}
     */
    this.char = char;

    /**
     * X position.
     *
     * @member {int}
     */
    this.x = 0;

    /**
     * Y position.
     *
     * @member {int}
     */
    this.y = 0;

    /**
     * Cursor visibility.
     *
     * @member {boolean}
     */
    this.visible = false;

    /**
     * Cursor color.
     *
     * @member {string}
     * @private
     */
    this.color = "#FFFFFF";

    /**
     * Canvas on which to draw cursor.
     *
     * @member {HTMLCanvasElement}
     */
    this.canvas = cancur;

    /**
     * Previous state.
     *
     * @member {string}
     * @private
     */
    this.previousState = "";

    /**
     * The indicator helps locating the cursor when developping or editing.
     *
     * @member {boolean}
     * @private
     */
    this.indicator = false;

    /**
     * Indicator width in characters.
     *
     * @member {number}
     * @readonly
     */
    this.indicatorWidth = 1;

    /**
     * Indicator height in characters.
     *
     * @member {number}
     * @readonly
     */
    this.indicatorHeight = 1;

    /**
     * Timer ID of the screen refresh timer.
     * @member {number}
     * @private
     */
    this.refresh = undefined;

    if (this.canvas !== undefined) {
      this.refresh = window.setInterval(() => this.draw(), 1000 / frameRate);
    }
  }

  /**
   * Enable or disable the indicator
   * @param {boolean} indicator true to enable the indicator, false otherwise.
   */
  setIndicator(indicator) {
    this.indicator = indicator;
    return this;
  }

  /**
   * Set indicator dimension.
   *
   * @param {number?} width New indicator width (1 by default).
   * @param {number?} height New indicator height (1 by default).
   */
  setDimension(width, height) {
    // Make sure width is valid.
    if (width === undefined || width < 1) {
      width = 1;
    } else if (this.x + width >= this.grid.cols) {
      width = this.grid.cols - this.x;
    }

    // Make sure height is valid.
    if (height === undefined || height < 1) {
      height = 1;
    } else if (this.y + height >= this.grid.rows) {
      height = this.grid.rows - this.y;
    }

    this.indicatorWidth = width;
    this.indicatorHeight = height;

    return this;
  }

  /**
   * Set cursor position.
   * This method does not check that coordinates are in rage of the text grid.
   * @param {int} x X position.
   * @param {int} y Y position.
   */
  set(x, y) {
    this.x = x;
    this.y = y;

    this.setDimension(this.indicatorWidth, this.indicatorHeight);

    return this;
  }

  /**
   * Move the cursor on the left.
   * This method does not check that coordinates are in rage of the text grid.
   * @return {int?} offset Offset to subtract from X position, 1 if not given.
   */
  left(offset) {
    this.set(this.x - (offset || 1), this.y);
  }

  /**
   * Move the cursor on the right.
   * This method does not check that coordinates are in rage of the text grid.
   * @return {int?} offset Offset to add to X position, 1 if not given.
   */
  right(offset) {
    this.set(this.x + (offset || 1), this.y);
  }

  /**
   * Move the cursor up.
   * This method does not check that coordinates are in rage of the text grid.
   * @return {int?} offset Offset to subtract from Y position, 1 if not given.
   */
  up(offset) {
    this.set(this.x, this.y - (offset || 1));
  }

  /**
   * Move the cursor down
   * This method does not check that coordinates are in rage of the text grid.
   * @return {int?} offset Offset to add to Y position, 1 if not given.
   */
  down(offset) {
    this.set(this.x, this.y + (offset || 1));
  }

  /**
   * Set cursor color.
   * @param {string} color Cursor color (#RRGGBB).
   */
  setColor(color) {
    this.color = color;

    return this;
  }

  /**
   * Set cursor visiblity.
   * @param {boolean} visible Cursor visibility
   */
  setVisible(visible) {
    this.visible = visible;
  }

  /**
   * Get cursor blink state.
   * @return {boolean}
   */
  getBlink() {
    const msecs = new Date().getTime();
    return msecs % 900 >= 450;
  }

  /**
   * Move the cursor to the first column of the first row.
   */
  home() {
    this.set(0, 1);
  }

  /**
   * Move the cursor to the last column of the current row.
   */
  lastColumn() {
    this.set(this.grid.cols - 1, this.y);
  }

  /**
   * Move the cursor to the first column of the current row.
   */
  firstColumn() {
    this.set(0, this.y);
  }

  /**
   * Move the cursor to the last row.
   */
  lastRow() {
    this.set(this.x, this.grid.rows - 1);
  }

  /**
   * Move the cursor to the status row.
   */
  statusRow() {
    this.set(this.x, 0);
  }

  /**
   * Move the cursor to the first row.
   */
  firstRow() {
    this.set(this.x, 1);
  }

  /**
   * Test if the cursor is on the status row.
   * @return {boolean}
   */
  isOnStatusRow() {
    return this.y === 0;
  }

  /**
   * Test if the cursor is on the first row.
   * @return {boolean}
   */
  isOnFirstRow() {
    return this.y === 1;
  }

  /**
   * Test if the cursor is on the last row.
   * @return {boolean}
   */
  isOnLastRow() {
    return this.y === this.grid.rows - 1;
  }

  /**
   * Test if the cursor is on the first column.
   * @return {boolean}
   */
  isOnFirstCol() {
    return this.x === 0;
  }

  /**
   * Test if the cursor is on the last column.
   * @return {boolean}
   */
  isOnLastCol() {
    return this.x === this.grid.cols - 1;
  }

  /**
   * Call a function for each position from home to cursor.
   * @param {execForXY} func Function to call for each coordinate.
   */
  homeToCursor(func) {
    range(0, this.x + 1).forEach((x) => func(x, this.y));

    const [cols, rows] = [this.grid.cols, this.y];
    range2([0, 0], [rows, cols]).forEach((y, x) => func(x, y));
  }

  /**
   * Call a function for each position from cursor to end of screen.
   * @param {execForXY} func Function to call for each coordinate.
   */
  cursorToEndOfScreen(func) {
    range(this.x, this.grid.cols).forEach((x) => func(x, this.y));

    const [cols, rows] = [this.grid.cols, this.grid.rows];
    range2([this.y + 1, 0], [rows, cols]).forEach((y, x) => func(x, y));
  }

  /**
   * Call a function for each position from cursor to end of line.
   * @param {execForXY} func Function to call for each coordinate.
   */
  cursorToEndOfLine(func) {
    range(this.x, this.grid.cols).forEach((x) => func(x, this.y));
  }

  /**
   * Call a function for each position in the status row.
   * @param {execForXY} func Function to call for each coordinate.
   */
  allStatusRow(func) {
    range(this.grid.cols).forEach((x) => func(x, 0));
  }

  /**
   * Call a function for each position from first column to cursor.
   * @param {execForXY} func Function to call for each coordinate.
   */
  firstColumnToCursor(func) {
    range(0, this.x + 1).forEach((x) => func(x, this.y));
  }

  /**
   * Call a function for each position on the current row.
   * @param {execForXY} func Function to call for each coordinate.
   */
  allCurrentRow(func) {
    range(0, this.grid.cols).forEach((x) => func(x, this.y));
  }

  /**
   * Test if the current Y position is out of range.
   * @return {boolean}
   */
  overflowY() {
    return this.y < 0 || this.y >= this.grid.rows;
  }

  /**
   * Test if the current X position is out of range.
   * @return {boolean}
   */
  overflowX() {
    return this.x < 0 || this.x >= this.grid.cols;
  }

  /**
   * Calculate a string identifying the current state
   * @return {string}
   * @private
   */
  currentState() {
    return (
      String(this.x) +
      "-" +
      String(this.y) +
      "-" +
      String(this.color) +
      "-" +
      String(this.visible) +
      "-" +
      String(this.indicator) +
      "-" +
      String(this.indicatorWidth) +
      "-" +
      String(this.indicatorHeight) +
      "-" +
      String(this.getBlink())
    );
  }

  /**
   * Draw the cursor
   */
  draw() {
    // Compare current and previous states to avoid unneeded drawing
    const currentState = this.currentState();
    if (currentState === this.previousState) {
      return;
    } else {
      this.previousState = currentState;
    }

    // Clear the cursor canvas
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Should the Minitel cursor be shown
    if (!this.isOnStatusRow() && this.visible && !this.getBlink()) {
      // Draw the cursor
      ctx.fillStyle = this.color;
      ctx.fillRect(
        this.x * this.char.width,
        this.y * this.char.height,
        this.char.width,
        this.char.height
      );
    }

    // Should the indicator be shown
    if (this.indicator) {
      // Draw the indicator
      ctx.beginPath();

      ctx.strokeStyle = "#FFFF00";
      ctx.setLineDash([2, 1]);

      ctx.moveTo(0, this.y * this.char.height);
      ctx.lineTo(1000, this.y * this.char.height);

      ctx.moveTo(0, (this.y + this.indicatorHeight) * this.char.height);
      ctx.lineTo(1000, (this.y + this.indicatorHeight) * this.char.height);

      ctx.moveTo(this.x * this.char.width, 0);
      ctx.lineTo(this.x * this.char.width, 1000);

      ctx.moveTo((this.x + this.indicatorWidth) * this.char.width, 0);
      ctx.lineTo((this.x + this.indicatorWidth) * this.char.width, 1000);

      ctx.stroke();
    }
  }

  /**
   * Get the cursor state
   * @return {object} The current cursor state
   */
  saveState() {
    return {
      x: this.x,
      y: this.y,
      color: this.color,
      visible: this.visible,
    };
  }

  /**
   * Restore the cursor state
   * @param {object} state The cursor state to restore
   */
  restoreState(state) {
    this.x = state.x;
    this.y = state.y;
    this.color = state.color;
    this.visible = state.visible;
  }
};

/**
 * @file vdu
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 *
 * VDU simulates a Minitel video display unit connected to a screen (a canvas)
 * and video memory (VRAM).
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * Video display unit is a rendering of a video memory in a canvas
 */
Minitel.VDU = class {
  /**
   * @param {Minitel.TextGrid} grid How the page is organized.
   * @param {Minitel.CharSize} char Character characteristics.
   * @param {HTMLCanvasElement} canvas The canvas which will be used as the
   *                                   screen.
   * @param {boolean} color true for color, false for black and white
   * @param {?HTMLCanvasElement} cancur The canvas which will be used to draw
   *                                    the cursor.
   */
  constructor(grid, char, canvas, color, cancur) {
    const frameRate = 50; // Frame per second

    /**
     * @member {TextGrid}
     * @private
     */
    this.grid = grid;

    /**
     * @member {CharSize}
     * @private
     */
    this.char = char;

    /**
     * @member {HTMLCanvasElement}
     * @private
     */
    this.canvas = canvas;

    /**
     * @member {CanvasRenderingContext2D}
     * @private
     */
    this.context = this.createContext();

    /**
     * The status character shown in the upper right corner of the screen
     * @member {int}
     * @private
     */
    this.statusCharacter = 0x46;

    /**
     * @member {boolean}
     * @private
     */
    this.globalMask = true;

    // Helper array
    const rows = [];
    range(this.grid.rows).forEach(() => rows.push(false));

    /**
     * Cursor position and visibility
     * @member {Minitel.VDUCursor}
     */
    this.cursor = new Minitel.VDUCursor(grid, char, cancur);

    /**
     * The video memory
     * @member {Minitel.VRAM}
     * @private
     */
    this.vram = new Minitel.VRAM(grid);

    /**
     * Keeps the last blink state
     * @member {boolean}
     * @private
     */
    this.lastblink = this.getBlink();

    /**
     * List indicating which row contains blinking characters.
     * @member {boolean[]}
     * @private
     */
    this.blinking = rows.map(() => false);

    // Marks all rows as changed
    /**
     * List indicating which row has been changed.
     * @member {boolean[]}
     */
    this.changed = rows.map(() => true);

    /**
     * G0 is the alphanumeric character set, G1 is the mosaic character set
     * G0d and G1d are the DRCS counterpart
     * @member {Object}
     * @property {FontSprite} G0 Standard font sprites
     * @property {FontSprite} G1 Mosaic font sprites
     * @property {FontSprite} G0d DRCS standard font sprites
     * @property {FontSprite} G1d DRCS mosaic font sprites
     * @private
     */
    this.font = {
      G0: this.loadFont("font/ef9345-g0.png"),
      G1: this.loadFont("font/ef9345-g1.png"),
      G0d: this.loadFont("font/blank.png"),
      G1d: this.loadFont("font/blank.png"),
    };

    this.changeColors(color);

    /**
     * Timer ID of the screen refresh timer.
     * @member {number}
     * @private
     */
    this.refresh = window.setInterval(() => {
      this.render();
      const cell = this.vram.get(this.cursor.x, this.cursor.y);
      this.cursor.setColor(this.colors[cell.fgColor]);
    }, 1000 / frameRate);
  }

  /**
   * Force redraw of the entire page.
   * @param {int?} row Index of row to redraw
   */
  redraw(row) {
    if (row === undefined) {
      this.changed = this.changed.map(() => true);
    } else {
      this.changed[row] = true;
    }
  }

  /**
   * Defines the status character shown in the upper right corner of the
   * Minitel screen.
   * @param {int} code the Minitel code to display.
   */
  setStatusCharacter(code) {
    this.statusCharacter = code;
  }

  /**
   * Set the Cell at (X, Y) position in page memory
   *
   * @param {number} x X position of the cell
   * @param {number} y Y position of the cell
   * @param {Cell} cell The cell
   */
  set(x, y, cell) {
    this.vram.set(x, y, cell);
    this.changed[y] = true;
  }

  /**
   * Get the Cell at (X, Y) position in page memory
   *
   * @param {number} x X position of the cell
   * @param {number} y Y position of the cell
   */
  get(x, y) {
    return this.vram.get(x, y);
  }

  /**
   * Clear the page
   */
  clear() {
    this.vram.clear();
    this.redraw();
  }

  /**
   * Scroll the video memory in a direction. It takes the page mode into
   * account.
   * @param {string} direction "up" or "down"
   */
  scroll(direction) {
    this.vram.scroll(direction);
    this.redraw();
  }

  /**
   * Get blink state.
   * @return {boolean}
   */
  getBlink() {
    const msecs = new Date().getTime();
    return msecs % 1500 >= 750;
  }

  /**
   * Initializes a context for rendering.
   * @return {CanvasRenderingContext2D}
   */
  createContext() {
    const ctx = this.canvas.getContext("2d");

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000000";
    ctx.fillRect(
      0,
      0,
      this.char.width * this.grid.cols,
      this.char.height * this.grid.rows
    );

    return ctx;
  }

  /**
   * Load a font.
   * @param {string} url URL of the font to load.
   * @param {string[]} colors List of colors to use in #RRGGBB format
   * @return {FontSprite}
   */
  loadFont(url) {
    return new Minitel.FontSprite(url, { cols: 8, rows: 16 }, this.char);
  }

  /**
   * Redefine a character (DRCS)
   * @param {number} ord Character ordinal
   * @param {number[]} design An array of 10 bytes defining the character
   */
  defineCharG0(ord, design) {
    this.font.G0d.defineChar(ord, design);
    this.redraw();
  }

  /**
   * Redefine a character (DRCS)
   * @param {number} ord Character ordinal
   * @param {number[]} design An array of 10 bytes defining the character
   */
  defineCharG1(ord, design) {
    this.font.G1d.defineChar(ord, design);
    this.redraw();
  }

  /**
   * Enable or disable the use of zone masking.
   * @param {boolean} enabled true enables the use of zone masking, false
   *                          disables the use of zone masking.
   */
  setGlobalMask(enabled) {
    this.globalMask = enabled;
    this.redraw();
  }

  /**
   * Change colors (black and white or color)
   * @param {boolean} color true for color, false for black and white
   */
  changeColors(color) {
    this.colors = color ? Minitel.colors : Minitel.grays;

    for (let index in this.font) {
      if (this.font.hasOwnProperty(index)) {
        this.font[index].color = color;
      }
    }

    this.redraw();
  }

  /**
   * Generate a thumbnail of the current display.
   *
   * @param {number} width Width of the thumbnail
   * @param {number} height Height of the thumbnail
   * @return {string} The data URL of the thumbnail in PNG format
   */
  generateThumbnail(width, height) {
    const thumbnail = document.createElement("canvas");

    thumbnail.width = width;
    thumbnail.height = height;

    const ctx = thumbnail.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(this.canvas, 0, 0, width, height);

    return thumbnail.toDataURL("image/png");
  }

  /**
   * Render the screen.
   * @private
   */
  render() {
    // Do not render if the fonts are not ready
    if (
      !this.font.G0.isReady ||
      !this.font.G1.isReady ||
      !this.font.G0d.isReady ||
      !this.font.G1d.isReady
    ) {
      return;
    }

    // Add the inverted F on the status line
    const fCell = new Minitel.CharCell();
    fCell.value = this.statusCharacter;
    fCell.invert = true;
    this.vram.set(38, 0, fCell);

    const blink = this.getBlink();

    // Draw each cell
    range(0, this.grid.rows).forEach((row) => {
      // Draw the row only if needed
      if (!this.changed[row]) {
        if (!this.blinking[row] || this.lastBlink === blink) {
          return;
        }
      }

      this.changed[row] = false;

      let blinkRow = this.drawRow(this.vram.get(row), row, blink);

      this.blinking[row] = blinkRow;
    });

    this.lastBlink = blink;
  }

  /**
   * Render one row.
   * @param {Cell[]} memoryRow list of Cell of the row to render
   * @param {integer} row row index
   * @param {boolean} blink
   * @return {boolean}
   * @private
   */
  drawRow(memoryRow, row, blink) {
    let bgColor = 0;
    let mask = false;
    let underline = false;

    const y = row * this.char.height;

    let blinkRow = false;

    range(0, this.grid.cols).forEach((col) => {
      const cell = memoryRow[col];
      const x = col * this.char.width;

      if (!(cell instanceof Minitel.CharCell)) {
        bgColor = cell.bgColor;
        underline = false;
      }

      if (!(cell instanceof Minitel.DelimiterCell) && cell.blink === true) {
        blinkRow = true;
      }

      let front = 7;
      let back = 0;
      if (!(cell instanceof Minitel.MosaicCell) && cell.invert === true) {
        [front, back] = [bgColor, cell.fgColor];
      } else {
        [front, back] = [cell.fgColor, bgColor];
      }

      this.drawCharacter(x, y, cell, front, back, mask, blink, underline);

      if (cell instanceof Minitel.DelimiterCell) {
        if (cell.mask !== undefined) {
          mask = this.globalMask && cell.mask;
        }

        if (cell.zoneUnderline !== undefined) {
          underline = cell.zoneUnderline;
        }
      }
    });

    return blinkRow;
  }

  /**
   * Render one character.
   * @param {integer} x x coordinate
   * @param {integer} y y coordinate
   * @param {Cell} cell Cell to render
   * @param {integer} front Foreground color (0 to 7)
   * @param {integer} back Background color (0 to 7)
   * @param {boolean} mask masking or not ?
   * @param {boolean} blink blinking or not ?
   * @param {boolean} underline underlining or not ?
   * @private
   */
  drawCharacter(x, y, cell, front, back, mask, blink, underline) {
    const ctx = this.context;

    // Draw background
    ctx.fillStyle = this.colors[back];
    ctx.fillRect(x, y, this.char.width, this.char.height);

    if (mask) {
      return;
    }

    if (
      !(cell instanceof Minitel.DelimiterCell) &&
      cell.blink &&
      blink === (cell instanceof Minitel.MosaicCell || !cell.invert)
    ) {
      return;
    }

    // Draw character
    let page;
    let part = { x: 0, y: 0 };
    let mult = { width: 1, height: 1 };
    let unde = false;

    if (cell instanceof Minitel.CharCell) {
      page = cell.drcs ? this.font.G0d : this.font.G0;
      part = cell.part;
      mult = cell.mult;
      unde = underline;
    } else if (cell instanceof Minitel.DelimiterCell) {
      page = cell.drcs ? this.font.G0d : this.font.G0;
      mult = cell.mult;
      unde = underline;
    } else {
      page = cell.drcs ? this.font.G1d : this.font.G1;
    }

    page.writeChar(ctx, cell.value, x, y, part, mult, front, unde);
  }

  /**
   * Get the word at a specific point
   * @param {int} x X position of a pixel on the canvas
   * @param {int} y Y position of a pixel on the canvas
   */
  getWordAt(x, y) {
    // Computes row and column
    const col = Math.floor((x * this.grid.cols) / this.canvas.offsetWidth);
    const row = Math.floor((y * this.grid.rows) / this.canvas.offsetHeight);

    return this.vram.getWordAt(col, row);
  }
};

/**
 * @file decoder.js
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * Class decoding a Videotex stream and updating a PageMemory
 */
Minitel.Decoder = class extends Minitel.Protocol {
  /**
   * Create a new Decoder.
   * @param {Minitel.VDU} vdu The visual display unit used to draw.
   * @param {Minitel.Keyboard} keyboard The keyboard emulator.
   * @param {} sender The function to use to send message to the network.
   * @param {HTMLAudioElement} bip The bip sound.
   */
  constructor(vdu, keyboard = null, sender = null, bip = null) {
    super();

    /**
     * Indicates whether the screen should be automatically scrolled
     * when reaching the bottom of the screen (roll mode) or if the cursor
     * should be put on the first row (page mode)
     * @member {string}
     * @private
     */
    this.pageMode = true;

    /**
     * The visual display unit to which the decoded character must be
     * applied.
     * @member {Minitel.VDU}
     * @private
     */
    this.vdu = vdu;

    this.clear("page");
    this.clear("status");

    this.resetCurrent();

    /**
     * Last drawn character, mainly used by the repeat functionality.
     * @member {number}
     * @private
     */
    this.charCode = 0x20;

    /**
     * A structure holding information about characters being currently
     * redefined.
     * @member {Object}
     * @property {boolean} g0 showing DRCS G0 (true) or standard G0 (false)?
     * @property {boolean} g1 showing DRCS G1 (true) or standard G1 (false)?
     * @property {string} charsetToDefine charset to define "G0" or "G1"
     * @property {number} startChar starting character (ord) to define
     * @property {number} count number of defining bytes read
     * @private
     */
    this.drcs = {
      g0: false,
      g1: false,
      charsetToDefine: undefined,
      startChar: undefined,
      count: 0,
    };

    /**
     * A function to communicate with if any, null if no connection.
     * @member {}
     * @private
     */
    this.sender = sender;

    if (sender) {
      this.vdu.setStatusCharacter(0x43);
    }

    /**
     * Indicates if keyboard keys must be sent to the screen (true) or not
     * (false).
     * @member {boolean} true for keys being sent to the screen (default for
     *                   a Minitel), false otherwise.
     * @private
     */
    this.keyboardToScreen = sender ? false : true;

    /**
     * The keyboard emulator if any, null if no keyboard emulator available.
     * @member {Keyboard}
     * @private
     */
    this.keyboard = keyboard;

    if (keyboard) {
      const that = this;
      keyboard.setEmitter(function (keycodes) {
        // Keyboard keys are sent to the screen if the Minitel is
        // configured to do this.
        if (that.keyboardToScreen) {
          that.decodeList(keycodes);
        }

        // Keyboard keys are to be sent to the network if it has been
        // properly open.
        if (that.sender !== null) {
          that.sender(
            keycodes.reduce(
              (accum, curr) => accum + String.fromCharCode(curr),
              ""
            )
          );
        }
      });
    }

    /**
     * The bip sound
     * @member {HTMLAudioElement}
     * @private
     */
    this.bip = bip;
  }

  /**
   * Save state before entering the status row
   * @private
   */
  saveState() {
    /**
     * A structure holding the state
     * @member {Object}
     * @property {Object} current current attributes
     * @property {Object} waiting waiting attributes
     * @property {Object} cursor current cursor position
     * @private
     */
    this.savedState = {
      current: Object.assign({}, this.current),
      waiting: Object.assign({}, this.waiting),
      cursor: this.vdu.cursor.saveState(),
    };
  }

  /**
   * Restore state after leaving the status row
   * @private
   */
  restoreState() {
    this.current = Object.assign({}, this.savedState.current);
    this.waiting = Object.assign({}, this.savedState.waiting);
    this.vdu.cursor.restoreState(this.savedState.cursor);
  }

  /**
   * Reset current attributes to default values
   * @private
   */
  resetCurrent() {
    /**
     * A structure holding the current attributes
     * @member {Object}
     * @property {Cell} charType current character type (CharCell or
     *                           SeparatedCell)
     * @property {Object} mult
     * @property {number} mult.width width multiplier (1 or 2)
     * @property {number} mult.height height multiplier (1 or 2)
     * @property {number} fgColor foreground color (0 to 7)
     * @property {number} bgColor background color (0 to 7)
     * @property {boolean} underline is underlining enabled?
     * @property {boolean} blink is blinking enabled?
     * @property {boolean} invert is video inverse enabled?
     * @property {boolean} mask is attribute masking enabled?
     * @property {boolean} separated is mosaic character separation enabled?
     * @private
     */
    this.current = {
      charType: Minitel.CharCell,
      mult: { width: 1, height: 1 },
      fgColor: 7,
      bgColor: 0,
      underline: false,
      blink: false,
      invert: false,
      mask: false,
      separated: false,
    };

    /**
     * A structure holding attributes waiting to be applied (serial
     * attributes)
     * @member {Object}
     * @property {number=} bgColor
     * @property {boolean=} mask
     * @property {boolean=} underline
     * @private
     */
    this.waiting = {
      bgColor: undefined,
      mask: undefined,
      underline: undefined,
    };
  }

  /**
   * Checks if serial attributes have been defined which are waiting to be
   * applied.
   * @private
   * @return {boolean} true if serial attributes are waiting to be applied,
   *                   false otherwise
   */
  serialAttributesDefined() {
    return (
      this.waiting.bgColor !== undefined ||
      this.waiting.underline !== undefined ||
      this.waiting.mask !== undefined
    );
  }

  /**
   * Move the cursor at a relative position
   * This method takes into account:
   * - whether the cursor is in the status row or not
   * - whether the width or height multiplier are used
   * - the current page mode
   * - whether the cursor is at the last column
   * @param {string} direction The direction to move the cursor to, can be
   *                           char, left, right, up, down, firstColumn or
   *                           home
   * @private
   */
  moveCursor(direction) {
    if (direction === "char") {
      // Moves the cursor after printing a character
      this.vdu.cursor.right(this.current.mult.width);
      if (this.vdu.cursor.overflowX()) {
        if (this.vdu.cursor.isOnStatusRow()) {
          // No overflow on status line
          this.vdu.cursor.lastColumn();
        } else {
          // Go to start of next row
          this.vdu.cursor.firstColumn();
          range(this.current.mult.height).forEach(() =>
            this.moveCursor("down")
          );
        }
      }
    } else if (direction === "left") {
      // Moves the cursor one column the left
      this.vdu.cursor.left();
      if (this.vdu.cursor.overflowX()) {
        this.vdu.cursor.lastColumn();
        this.moveCursor("up");
      }
    } else if (direction === "right") {
      // Moves the cursor one column on the right
      this.vdu.cursor.right();
      if (this.vdu.cursor.overflowX()) {
        this.vdu.cursor.firstColumn();
        this.moveCursor("down");
      }
    } else if (direction === "up") {
      // Moves the cursor one row up
      if (this.vdu.cursor.isOnStatusRow()) return;

      this.vdu.cursor.up();

      if (this.vdu.cursor.isOnStatusRow()) {
        if (this.pageMode) {
          this.vdu.cursor.lastRow();
        } else {
          this.vdu.cursor.firstRow();
          this.vdu.scroll("down");
        }
      }
    } else if (direction === "down") {
      // Move the cursor one row down
      if (this.vdu.cursor.isOnStatusRow()) {
        // Restore the state before leaving the status row
        this.restoreState();
      } else {
        this.vdu.cursor.down();

        if (this.vdu.cursor.overflowY()) {
          if (this.pageMode) {
            this.vdu.cursor.firstRow();
          } else {
            this.vdu.cursor.lastRow();
            this.vdu.scroll("up");
          }
        }
      }
    } else if (direction === "firstColumn") {
      // Moves the cursor on the first column of the current row
      this.vdu.cursor.firstColumn();
    } else if (direction === "home") {
      // Moves the cursor on the first column, first row and reset
      // current attributes.
      this.vdu.cursor.home();
      this.resetCurrent();
    }
  }

  /**
   * Clear a portion of the screen.
   * @param {string} clearRange Which part of the screen should be cleared, it
   *                            can be either page, status, eol, endofscreen,
   *                            startofscreen, startofline, completescreen or
   *                            completeline
   * @private
   */
  clear(clearRange) {
    if (clearRange === "page") {
      // Clear the whole screen except the status row ,reset current
      // attributes and place the cursor on the first column, first row
      this.vdu.clear();
      this.vdu.cursor.home();
      this.resetCurrent();
      return;
    }

    if (clearRange === "status") {
      // Clear status row
      this.vdu.cursor.allStatusRow((x, y) => {
        this.vdu.set(x, y, new Minitel.MosaicCell());
      });

      return;
    }

    if (clearRange === "eol") {
      // Clear from the current cursor position till the end of the line
      const saveX = this.vdu.cursor.x;
      const saveY = this.vdu.cursor.y;
      const savePageMode = this.pageMode;

      // Clearing must not scroll the screen
      this.pageMode = true;
      this.vdu.cursor.cursorToEndOfLine(() => this.print(0x20));
      this.vdu.cursor.x = saveX;
      this.vdu.cursor.y = saveY;
      this.pageMode = savePageMode;
      return;
    }

    // CSI sequences do not work on status row
    if (this.vdu.cursor.isOnStatusRow()) return;

    if (clearRange === "endofscreen") {
      // Clear from the current cursor position till the end of the screen
      this.vdu.cursorToEndOfScreen((x, y) => {
        this.vdu.set(x, y, new Minitel.MosaicCell());
      });

      return;
    }

    if (clearRange === "startofscreen") {
      // Clear from the current cursor position till the start of the
      // screen
      this.vdu.cursor.homeToCursor((x, y) => {
        this.vdu.set(x, y, new Minitel.MosaicCell());
      });

      return;
    }

    if (clearRange === "startofline") {
      // Clear from the start of the row till the current cursor position
      this.vdu.cursor.firstColumnToCursor((x, y) => {
        this.vdu.set(x, y, new Minitel.MosaicCell());
      });

      return;
    }

    if (clearRange === "completescreen") {
      // Clear complete screen without moving the cursor nor losing
      // current attributes
      this.vdu.clear();
      return;
    }

    if (clearRange === "completeline") {
      // Clear the current line
      this.vdu.cursor.allCurrentRow((x, y) => {
        this.vdu.set(x, y, new Minitel.MosaicCell());
      });

      return;
    }
  }

  /**
   * Set the current page mode
   * @param {boolean} bool true indicates the screen is in page mode while
   *                       false indicates the screen is in roll mode
   * @private
   */
  setPageMode(bool) {
    this.pageMode = bool;
  }

  /**
   * Emits a beep sound
   * @private
   */
  beep() {
    if (this.bip !== null) {
      this.bip.currentTime = 0;
      this.bip.play();
    }
  }

  /**
   * Set the uppercase mode of the keyboard
   * @param {boolean} bool true indicates the keyboard operates in uppercase
   *                       false indicates the keyboard operates in lowercase
   * @private
   */
  setUppercaseMode(bool) {
    this.keyboard.setUppercaseMode(bool);
  }

  /**
   * Set the extended mode of the keyboard
   * @param {boolean} bool true indicates the keyboard works extended
   *                       false indicates the keyboard works standard
   * @private
   */
  setExtendedMode(bool) {
    this.keyboard.setExtendedMode(bool);
  }

  /**
   * Set the cursor keys of the keyboard
   * @param {boolean} bool true indicates keyboard use cursor keys
   *                       false indicates keyboard does not use cursor keys
   * @private
   */
  setCursorKeys(bool) {
    this.keyboard.setCursorKeys(bool);
  }

  /**
   * Set the current character type.
   * Doing so resets some attributes even if the current character type does
   * not change.
   * @param {string} charPage either G0 or G1
   * @private
   */
  setCharType(charPage) {
    this.current.separated = false;
    this.current.invert = false;
    this.current.mult = { width: 1, height: 1 };

    if (charPage === "G0") {
      this.current.charType = Minitel.CharCell;
    } else if (charPage === "G1") {
      this.current.charType = Minitel.MosaicCell;
      this.current.underline = false;
      if (this.waiting.bgColor !== undefined) {
        this.current.bgColor = this.waiting.bgColor;
        this.waiting.bgColor = undefined;
      }
    }
  }

  /**
   * Sets the cursor visibility
   * @param {boolean} visibility true for a visibile cursor, false otherwise
   * @private
   */
  showCursor(visibility) {
    this.vdu.cursor.setVisible(visibility);
  }

  /**
   * Sets the foreground color
   * @param {number} color the foreground color (0 to 7)
   * @private
   */
  setFgColor(color) {
    this.current.fgColor = color;
  }

  /**
   * Sets the background color
   * @param {number} color the background color (0 to 7)
   * @private
   */
  setBgColor(color) {
    if (this.current.charType === Minitel.CharCell) {
      this.waiting.bgColor = color;
    } else if (this.current.charType === Minitel.MosaicCell) {
      this.current.bgColor = color;
    }
  }

  /**
   * Sets the character size.
   * This is valid only for alphanumerical character and when not in the
   * status row.
   * @param {string} sizeName the size can be either: normalSize, doubleWidth,
   *                          doubleHeight or doubleSize.
   * @private
   */
  setSize(sizeName) {
    if (this.vdu.cursor.isOnStatusRow()) return;
    if (this.current.charType !== Minitel.CharCell) return;

    const sizes = {
      normalSize: { width: 1, height: 1 },
      doubleWidth: { width: 2, height: 1 },
      doubleHeight: { width: 1, height: 2 },
      doubleSize: { width: 2, height: 2 },
    };

    if (!(sizeName in sizes)) return;
    if (this.vdu.cursor.isOnFirstRow() && sizes[sizeName].height === 2) return;

    this.current.mult = sizes[sizeName];
  }

  /**
   * Sets the text blinking
   * @param {boolean} blink true for blinking text, false otherwise
   * @private
   */
  setBlink(blink) {
    this.current.blink = blink;
  }

  /**
   * Sets the masking of attributes
   * @param {boolean} mask true for attributes masking, false otherwise
   * @private
   */
  setMask(mask) {
    this.waiting.mask = mask;
  }

  /**
   * Enables or disables the use of zone masking
   * @param {boolean} enabled true enables the use of zone masking, false
   *                          disables the use of zone masking
   * @private
   */
  setGlobalMask(enabled) {
    this.vdu.setGlobalMask(enabled);
  }

  /**
   * Set underline of text or separation of mosaic characters
   * @param {boolean} underline true for text underlining, false otherwise
   * @private
   */
  setUnderline(underline) {
    if (this.current.charType === Minitel.CharCell) {
      this.waiting.underline = underline;
    } else if (this.current.charType === Minitel.MosaicCell) {
      this.current.separated = underline;
    }
  }

  /**
   * Set video inversion of alphanumerical characters
   * @param {boolean} invert true for video inverse, false otherwise
   * @private
   */
  setInvert(invert) {
    if (this.current.charType === Minitel.MosaicCell) return;

    this.current.invert = invert;
  }

  /**
   * Move the cursor at an absolute position.
   * Doing so resets the current attributes.
   * @param {boolean} invert true for video inverse, false otherwise
   * @private
   */
  locate(y, x) {
    if (y === 0x30 || y === 0x31 || y === 0x32) {
      // This form of absolute positionning is indicated as deprecated
      // but is nonetheless supported by every Minitel. It moves the
      // cursor at the first column of a specific row
      y = 10 * (y - 0x30) + (x - 0x30);
      x = 1;
    } else {
      // Standard absolute positionning of the cursor
      x -= 0x40;
      y -= 0x40;
    }

    // Ignores everything that is outside of the screen
    if (x < 1 || x > 40) return;
    if (y < 0 || y > 24) return;

    // Save current state before going on row 0
    if (y === 0) {
      this.saveState();
      this.showCursor(false);
    }

    // Minitel works from 1 to 40 while the PageMemory works with 0 to 39
    this.vdu.cursor.set(x - 1, y);

    this.resetCurrent();
  }

  /**
   * Prints a delimiter at the current cursor position.
   * Printing a delimiter will apply the waiting attributes.
   * @param {number} charCode the delimiter code to print (usually 0x20)
   * @private
   */
  printDelimiter(charCode) {
    const x = this.vdu.cursor.x;
    const y = this.vdu.cursor.y;

    const cell = new Minitel.DelimiterCell();
    cell.value = charCode;
    cell.fgColor = this.current.fgColor;
    cell.invert = this.current.invert;
    cell.mult = this.current.mult;

    // Background color
    if (this.waiting.bgColor === undefined) {
      cell.bgColor = this.current.bgColor;
    } else {
      cell.bgColor = this.waiting.bgColor;
      this.waiting.bgColor = undefined;
    }
    this.current.bgColor = cell.bgColor;

    // Underline
    cell.zoneUnderline = this.current.underline;
    if (this.waiting.underline !== undefined) {
      cell.zoneUnderline = this.waiting.underline;
      this.current.underline = this.waiting.underline;
      this.waiting.underline = undefined;
    }

    // Mask
    cell.mask = this.current.mask;
    if (this.waiting.mask !== undefined) {
      cell.mask = this.waiting.mask;
      this.current.mask = this.waiting.mask;
      this.waiting.mask = undefined;
    }

    range2([cell.mult.height, cell.mult.width]).forEach((j, i) => {
      const newCell = cell.copy();
      this.vdu.set(x + i, y - j, newCell);
    });
  }

  /**
   * Prints a G0 character.
   * G0 characters are standard alphanumerical characters.
   * @param {number} charCode the character code of the character to print
   * @private
   */
  printG0Char(charCode) {
    const x = this.vdu.cursor.x;
    const y = this.vdu.cursor.y;

    const cell = new Minitel.CharCell();
    cell.value = charCode;
    cell.fgColor = this.current.fgColor;
    cell.blink = this.current.blink;
    cell.invert = this.current.invert;
    cell.mult = this.current.mult;

    // DRCS is ineffictive on the status row
    cell.drcs = y === 0 ? false : this.drcs.g0;

    range2([cell.mult.height, cell.mult.width]).forEach((j, i) => {
      const newCell = cell.copy();
      newCell.part = { x: i, y: cell.mult.height - j - 1 };
      this.vdu.set(x + i, y - j, newCell);
    });
  }

  /**
   * Prints a G1 character.
   * G1 characters are semigraphic characters (mosaic).
   * @param {number} charCode the character code of the character to print
   * @private
   */
  printG1Char(charCode) {
    const cell = new Minitel.MosaicCell();
    cell.value = charCode;
    cell.fgColor = this.current.fgColor;
    cell.bgColor = this.current.bgColor;
    cell.blink = this.current.blink;
    cell.separated = this.current.separated;
    cell.drcs = this.vdu.cursor.isOnStatusRow() ? false : this.drcs.g1;

    // Adjust the character code when not printing DRCS characters
    if (cell.value >= 0x20 && cell.value <= 0x5f && !cell.drcs) {
      cell.value += 0x20;
    }

    if (cell.separated === true) {
      cell.value -= 0x40;
    }

    this.vdu.set(this.vdu.cursor.x, this.vdu.cursor.y, cell);
  }

  /**
   * Prints a character and moves the cursor.
   * @param {number} charCode the character code of the character to print
   * @private
   */
  print(charCode) {
    if (this.current.charType === Minitel.MosaicCell) {
      // MosaicCell are tested first because there is no delimiter for
      // this character types (no serial attributes)
      this.printG1Char(charCode);
    } else if (charCode === 0x20 && this.serialAttributesDefined()) {
      // A space is a delimiter only if there are serial attributes
      // waiting to be applied
      this.printDelimiter(charCode);
    } else if (this.current.charType === Minitel.CharCell) {
      this.printG0Char(charCode);
    }

    this.charCode = charCode;
    this.moveCursor("char");
  }

  /**
   * Repeat the last printed character.
   * @param {number} count the number of repetitions
   * @private
   */
  repeat(count) {
    count -= 0x40;
    range(count).forEach(() => this.print(this.charCode));
  }

  /**
   * Set the charset to define
   * @param {string} charsetToDefine charset to define, "G0" or "G1"
   * @private
   */
  drcsDefineCharset(charset) {
    this.drcs.charsetToDefine = charset;
  }

  /**
   * Set the ordinal number of the first character to redefine
   * @param {number} startChar starting character (ord) to define
   * @private
   */
  drcsSetStartChar(startChar) {
    this.drcs.startChar = startChar;
  }

  /**
   * Start a new serie of redefinition bytes
   * @private
   */
  drcsStart() {
    this.drcs.count = 0;
  }

  /**
   * Increment the count of redefinition bytes
   * @private
   */
  drcsInc() {
    this.drcs.count++;
  }

  /**
   * Redefine one character based on previous redefinition bytes
   * @private
   */
  drcsDefineChar() {
    // Do not take the last byte into account (usually 0x30 or 0x1F used
    // as separator).
    const sextets = this.previousBytes
      .lastValues(this.drcs.count + 1)
      .slice(0, -1)
      .map((value) => (value - 0x40) & 0x3f);

    // Converts 14 6-bits values to 10 8-bits values
    // 0      1      2      3     !4      5      6      7     !8
    // 543210 543210 543210 543210 543210 543210 543210 543210 543210...
    // 765432 107654 321076 543210 765432 107654 321076 543210 765432...
    const bytes = [
      (sextets[0] << 2) | (sextets[1] >> 4),
      ((sextets[1] & 0xf) << 4) | (sextets[2] >> 2),
      ((sextets[2] & 3) << 6) | sextets[3],

      (sextets[4] << 2) | (sextets[5] >> 4),
      ((sextets[5] & 0xf) << 4) | (sextets[6] >> 2),
      ((sextets[6] & 3) << 6) | sextets[7],

      (sextets[8] << 2) | (sextets[9] >> 4),
      ((sextets[9] & 0xf) << 4) | (sextets[10] >> 2),
      ((sextets[10] & 3) << 6) | sextets[11],

      (sextets[12] << 2) | (sextets[13] >> 4),
    ];

    // Two sets can be redefined, the standard and the mosaic sets
    if (this.drcs.charsetToDefine === "G0") {
      this.vdu.defineCharG0(this.drcs.startChar, bytes);
    } else {
      this.vdu.defineCharG1(this.drcs.startChar, bytes);
    }

    // Prepare for the next redefinition
    this.drcs.startChar++;
    this.drcs.count = 0;
  }

  /**
   * Sets the character set used for G0
   * @param {boolean} bool true for the DRCS set, false for the standard set
   * @private
   */
  drcsUseG0(bool) {
    this.drcs.g0 = bool;
  }

  /**
   * Sets the character set used for G1
   * @param {boolean} bool true for the DRCS set, false for the standard set
   * @private
   */
  drcsUseG1(bool) {
    this.drcs.g1 = bool;
  }

  /**
   * Enable the extended keyboard
   * @param {boolean} bool true to enable, false to disable.
   * @private
   */
  setExtendedKeyboard(bool) {
    if (this.keyboard !== null) {
      this.keyboard.setExtendedMode(bool);
    }
  }

  /**
   * Change the handling of cursor keys
   * @param {boolean} bool true to use C0, false to use standard codes.
   * @private
   */
  setCursorKeyboard(bool) {
    if (this.keyboard !== null) {
      this.keyboard.setCursorKeyboard(bool);
    }
  }

  /**
   * Set switch between two part of the Minitel architecture.
   * @param {boolean} switchOn true to enable, false to disable.
   * @param {string} destination may be only "screen" for the moment.
   * @param {string} source may be only "keyboard" for the moment.
   * @private
   */
  setSwitch(switchOn, destination, source) {
    if (destination === "screen" && source === "keyboard") {
      this.keyboardToScreen = switchOn;
    }
  }
};

/**
 * @file keyboard
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 *
 * Keyboard simulates a Minitel keyboard from a standard keyboard.
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * The EmitterHandler callback handles code sequences generated by a Keyboard
 * object.
 * @name EmitterHandler
 * @function
 * @param {Int[]} sequence Minitel code sequence
 */

/**
 * The ConfigHandler callback handles settings changes.
 * @name ConfigHandler
 * @function
 * @param {Object} settings Settings value
 */

/**
 * Keyboard converts keys received by the browser into Minitel keys.
 */
Minitel.Keyboard = class {
  /**
     * @param {HTMLElement} container Element containing all keyboard elements.
     * @param {EmitterHandler?} emitter An emitter handler that will be called
     *                                  everytime a key generates Minitel codes.
     * @param {ConfigHandler?} emitter A config handler that will be called
                                       everytime the user changes a setting.
     */
  constructor(container, emitter, config) {
    /**
     * Remembers if the ctrl key is down.
     * @member {boolean}
     * @private
     */
    this.kCtrl = false;

    /**
     * Remembers if the shift key is down.
     * @member {boolean}
     * @private
     */
    this.kShift = false;

    /**
     * Remembers if the fnct key is down.
     * @member {boolean}
     * @private
     */
    this.kFnct = false;

    /**
     * Does the keyboard works in extended mode?
     * @member {boolean}
     * @private
     */
    this.kExtended = false;

    /**
     * Does the keyboard generates code for the cursor keys?
     * @member {boolean}
     * @private
     */
    this.kCursorKeys = false;

    /**
     * Does the keyboard works in uppercase mode? (default mode of Minitel)
     * @member {boolean}
     * @private
     */
    this.kUppercase = true;

    /**
     * The EmitterHandler associated with the keyboard.
     * @member {EmitterHandler}
     * @private
     */
    this.emitter = undefined;
    this.setEmitter(emitter);

    /**
     * The ConfigHandler associated with the keyboard.
     * @member {ConfigHandler}
     * @private
     */
    this.config = undefined;
    this.setConfig(config);

    // Look for all elements
    const elements = new Minitel.Elements();
    elements
      .add("keyalpha")
      .add("keynonalpha")
      .add("keyconfig")
      .add("keysound")
      .foundIn(container);

    /**
     * The alphabetical keys page.
     * @member {HTMLElement}
     * @private
     */
    this.pageAlpha = elements.keyalpha;

    /**
     * The non-alphabetical keys page.
     * @member {HTMLElement}
     * @private
     */
    this.pageNAlpha = elements.keynonalpha;

    /**
     * The config page.
     * @member {HTMLElement}
     * @private
     */
    this.pageConfig = elements.keyconfig;

    /**
     * The key simulator.
     * @member {KeySimulator}
     * @private
     */
    this.simulator = elements.keysound
      ? new KeySimulator(elements.keysound)
      : undefined;

    // Install events listener
    document.addEventListener("keyup", (event) => this.onkeyup(event));
    document.addEventListener("keypress", (event) => this.onkeypress(event));
    container.autocallback(this);
  }

  /**
   * Defines an EmitterHandler which will be called everytime a key is
   * is pressed.
   * @member {EmitterHandler}
   */
  setEmitter(emitter) {
    this.emitter = emitter;
  }

  /**
   * Handles key press events.
   * @private
   */
  keypress(keycodes) {
    if (this.emitter && keycodes !== null) {
      this.emitter(keycodes);
    }
  }

  /**
   * Defines a ConfigHandler which will be called everytime a setting is
   * changed by the user.
   * @member {ConfigHandler}
   */
  setConfig(config) {
    this.config = config;
  }

  /**
   * Select the speed on the config form.
   * @param {string} speed "1200", "4800", "9600" or "FULL"
   */
  selectSpeed(speed) {
    this.pageConfig.querySelector(".config-speed>select").value = speed;
  }

  /**
   * Select the color on the config form.
   * @param {string} color "true" or "false"
   */
  selectColor(color) {
    this.pageConfig.querySelector(".config-color>select").value = color;
  }

  /**
   * Handles settings changes.
   * @param {HTMLEvent} event
   * @param {string} param
   * @private
   */
  onSettingChanged(event) {
    if (this.config === undefined) return;

    const speed = event.target.querySelector(".config-speed>select").value;
    const color = event.target.querySelector(".config-color>select").value;

    this.config({
      speed: speed === "FULL" ? 0 : parseInt(speed),
      color: color === "true",
    });
  }

  /**
   * Handles Alpha button event.
   * @private
   */
  onAlpha() {
    this.pageNAlpha.classList.add("hidden");
    this.pageConfig.classList.add("hidden");
    this.pageAlpha.classList.remove("hidden");
  }

  /**
   * Handles NAlpha button event.
   * @private
   */
  onNAlpha() {
    this.pageAlpha.classList.add("hidden");
    this.pageConfig.classList.add("hidden");
    this.pageNAlpha.classList.remove("hidden");
  }

  /**
   * Handles Config button event.
   * @private
   */
  onConfig() {
    this.pageAlpha.classList.add("hidden");
    this.pageNAlpha.classList.add("hidden");
    this.pageConfig.classList.remove("hidden");
  }

  /**
   * Handles key up events.
   * @private
   */
  onkeyup(event) {
    event.preventDefault();
  }

  /**
   * Handles key press events.
   * @private
   */
  onkeypress(event) {
    this.kShift = event.shiftKey;
    this.keypress(this.toMinitel(event.key));
    event.preventDefault();
  }

  /**
   * Handles click events.
   * @private
   */
  onclick(event, param) {
    // Make a sound
    if (this.simulator) {
      this.simulator.pressKey(param);
    }

    if (param === "Maj") {
      this.kShift = !this.kShift;
    }

    this.keypress(this.toMinitel(param));
  }

  /**
   * Set the uppercase mode of the keyboard
   * @param {boolean} bool true indicates the keyboard operates in uppercase
   *                       false indicates the keyboard operates in lowercase
   */
  setUppercaseMode(bool) {
    this.kUppercase = bool;
  }

  /**
   * Set the extended mode of the keyboard
   * @param {boolean} bool true indicates the keyboard works extended
   *                       false indicates the keyboard works standard
   */
  setExtendedMode(bool) {
    this.kExtended = bool;
  }

  /**
   * Set the cursor keys of the keyboard
   * @param {boolean} bool true indicates keyboard use cursor keys
   *                       false indicates keyboard does not use cursor keys
   */
  setCursorKeys(bool) {
    this.kCursorKeys = bool;
  }

  /**
   * Converts a key to a Minitel code sequence according to the current state
   * of the keyboard.
   * @param {String} key A string identifying a key.
   * @return {Int[]} The Minitel code sequence corresponding or null if the
   *                 key cannot be converted.
   */
  toMinitel(key) {
    if (key.length === 1) {
      // Handles uppercase mode and shift key
      if (this.kUppercase !== this.kShift) {
        key = key.toUpperCase();
      } else {
        key = key.toLowerCase();
      }
    } else {
      if (key in Minitel.pcToMinitelKeys) {
        key = Minitel.pcToMinitelKeys[key];
      }
    }

    if (key in Minitel.keys.Videotex) {
      return Minitel.keys.Videotex[key];
    }

    return null;
  }
};

/**
 * @file minitel-emulator.js
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

/**
 * @class Emulator
 */
Minitel.Emulator = class {
  /**
   * @param {HTMLElement} container Element containing all the needed elements
   *                                for the emulator.
   * @param {boolean?} color Should we use color (true) or grayscale (false).
   * @param {int?} speed Speed in bits per second, -1 for full speed.
   */
  constructor(container, color, speed) {
    // Initializes basic properties
    const grid = new Minitel.TextGrid(Minitel.columns, Minitel.rows);
    const char = new Minitel.CharSize(Minitel.charWidth, Minitel.charHeight);

    // Look for all elements
    const elements = new Minitel.Elements();
    elements
      .add("screen")
      .add("cursor")
      .add("keyboard")
      .add("beep")
      .foundIn(container);

    // The screen canvas is the only mandatory element
    if (elements.screen === undefined) {
      console.error("The emulator container has no canvas for screen.");
      return;
    }

    // Resize canvas based on Minitel characteristics
    elements.screen.width = char.width * grid.cols;
    elements.screen.height = char.height * grid.rows;

    // Resize the cursor canvas to the Minitel canvas size.
    if (elements.cursor !== undefined) {
      elements.cursor.width = elements.screen.width;
      elements.cursor.height = elements.screen.height;
    }

    /**
     * Should we consume new incoming bytes?
     * @member {boolean}
     */
    this.pause = false;

    /**
     * A handler which will be called to record frames.
     * @member {function}
     */
    this.recordHandler = undefined;

    /**
     * A handler which will be called each time the buffer is empty.
     * @member {function}
     */
    this.emptyHandler = undefined;

    /**
     * Should we show colors or grayscale?
     * @member {boolean}
     */
    this.color = color;

    /**
     * The visual display unit
     * @member {Minitel.VDU}
     * @private
     */
    this.vdu = new Minitel.VDU(
      grid,
      char,
      elements.screen,
      this.color ? Minitel.colors : Minitel.greys,
      elements.cursor
    );

    /**
     * Keyboard associated with the emulator
     * @member {Keyboard}
     * @private
     */
    this.keyboard = elements.keyboard
      ? new Minitel.Keyboard(elements.keyboard)
      : undefined;

    /**
     * The socket associated to the emulator
     * @member {Socket}
     */
    const urlParams = new URLSearchParams(window.location.search);
    let socketURL =
      urlParams.get("url") ||
      container.getAttribute("data-socket") ||
      undefined;
    if (
      !socketURL &&
      (location.protocol === "https:" || location.protocol === "http:")
    ) {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      socketURL = `${proto}//${location.host}`;
    }
    this.socket = socketURL ? new WebSocket(socketURL) : undefined;

    if (this.socket) {
      this.socket.onopen = () => {
        // Add a link: network → decoder
        this.socket.onmessage = (messageEvent) => {
          const message = [];
          range(messageEvent.data.length).forEach((offset) => {
            message.push(messageEvent.data[offset].charCodeAt(0));
          });

          this.send(message);
        };

        // Add a link: keyboard → network
        if (this.keyboard) {
          this.keyboard.setEmitter((keycodes) =>
            this.socket.send(
              keycodes.map((c) => String.fromCharCode(c)).join("")
            )
          );
        }
      };

      this.socket.onclose = () => {
        this.vdu.setStatusCharacter(0x46);
        if (this.keyboard) this.keyboard.setEmitter(undefined);
      };
    }

    // Add a link: decoder → network
    const sender = (message) => {
      if (this.socket) {
        this.socket.send(message);
      }
    };

    /**
     * The decoder
     * @member {MinitelDecoder}
     * @private
     */
    this.decoder = new Minitel.Decoder(
      this.vdu,
      this.keyboard,
      sender,
      elements.beep
    );

    /**
     * The queue
     * @member {number[]}
     * @private
     */
    this.queue = [];

    /**
     * How many bytes are sent to the page memory each refresh time
     * @member {number}
     */
    this.chunkSize = 0;

    /**
     * The ID value of the timer used to refresh the Minitel screen
     * @param {number}
     */
    this.timer = undefined;

    /**
     * Should the cursor position be shown?
     * @param {boolean}
     */
    this.cursorShown = false;

    /**
     * Current speed, 0 for maximum speed
     * @param {number}
     */
    this.bandwidth = -1;

    // Sets colors
    this.setColor(color ?? container.getAttribute("data-color") ?? false);

    // Sets speed
    this.setRefresh(
      speed ??
        parseInt(container.getAttribute("data-speed"), 10) ??
        Minitel.B1200
    );

    // Add event listeners
    elements.screen.addEventListener("click", (event) => this.onClick(event));

    // Add a link: keyboard → emulator
    if (this.keyboard) {
      this.keyboard.setConfig((settings) => {
        this.setColor(settings.color);
        this.setRefresh(settings.speed);
      });
    }
  }

  /**
   * Initializes the timer used to refresh the Minitel screen
   *
   * @param {number} bandwidth Bandwidth in bits per second
   * @param {number} rate Refresh rate in milliseconds
   */
  initRefresh(bandwidth, rate) {
    // Stop any existing timer
    if (this.timer) window.clearInterval(this.timer);

    // Minitel uses 9 bits for each code (7 bit of data, 1 parity bit and
    // 1 stop bit)
    this.chunkSize = bandwidth === 0 ? 2048 : bandwidth / 9 / (1000 / rate);

    // Change rate if chunksize is below 1
    if (this.chunkSize < 1) {
      this.chunkSize = 1;
      rate = (9 * 1000) / bandwidth;
    }

    this.timer = window.setInterval(() => {
      if (this.pause) return;

      this.pause = true;
      this.sendChunk();
      if (this.recordHandler) this.recordHandler(this.vdu.canvas, rate);
      this.pause = false;
    }, rate);
  }

  /**
   * Push values in the queue for future send
   * @param {number[]} items Values to send
   */
  send(items) {
    this.queue = this.queue.concat(items);
  }

  /**
   * Directly send values to the page memory, bypassing the refresh rate.
   * @param {number[]} items Values to send
   */
  directSend(items) {
    this.queue = [];
    this.decoder.decodeList(items);
  }

  /**
   * Generate a thumbnail of the current display.
   * @param {number} width Width of the thumbnail
   * @param {number} height Height of the thumbnail
   */
  generateThumbnail(width, height) {
    return this.vdu.generateThumbnail(width, height);
  }

  /**
   * Send a chunk of the queue to the page memory. This method is called by
   * the timer.
   * @private
   */
  sendChunk() {
    // Nothing to do?
    if (this.queue.length === 0) return;

    const chunk = this.queue.slice(0, this.chunkSize);
    this.queue = this.queue.slice(this.chunkSize);
    this.decoder.decodeList(chunk);

    if (this.emptyHandler && this.queue.length === 0) this.emptyHandler();
  }

  /**
   * Tells the emulator to use color (true) or black & white (false)
   * @param {boolean} color
   */
  setColor(color) {
    if (this.color !== color) {
      this.color = color;
      this.vdu.changeColors(color);
      if (this.keyboard) {
        this.keyboard.selectColor(color ? "true" : "false");
      }
    }

    return this;
  }

  /**
   * Set refresh rate
   * @param {number} bandwidth Bits per second or 0 for maximum speed
   * @param {?number} rate Refresh rate of the screen in hertz, 25 by default
   */
  setRefresh(bandwidth, rate) {
    if (this.bandwidth !== bandwidth) {
      // Refresh rate, 25 Hz by default
      if (rate === undefined) rate = 40;

      this.bandwidth = bandwidth;
      this.initRefresh(bandwidth, rate);
      if (this.keyboard) {
        this.keyboard.selectSpeed(
          bandwidth === 0 ? "FULL" : bandwidth.toString()
        );
      }
    }

    return this;
  }

  /**
   * Handles clicks on the Minitel screen.
   * @param {HTMLEvent} event The event
   */
  onClick(event) {
    // Get the word where the user clicked
    const rect = event.target.getBoundingClientRect();
    const keyword = this.vdu.getWordAt(
      event.pageX - rect.left - window.scrollX,
      event.pageY - rect.top - window.scrollY
    );

    if (keyword === "") return true;

    // The keyword can designate a special Minitel key.
    let message = [];
    switch (keyword.toUpperCase()) {
      case "SOMMAIRE":
      case "SOMM":
        message = Minitel.keys.Videotex.Sommaire;
        break;
      case "ANNULATION":
      case "ANNUL":
        message = Minitel.keys.Videotex.Annulation;
        break;
      case "RETOUR":
        message = Minitel.keys.Videotex.Retour;
        break;
      case "GUIDE":
        message = Minitel.keys.Videotex.Guide;
        break;
      case "CORRECTION":
      case "CORR":
        message = Minitel.keys.Videotex.Correction;
        break;
      case "SUITE":
        message = Minitel.keys.Videotex.Suite;
        break;
      case "ENVOI":
        message = Minitel.keys.Videotex.Envoi;
        break;
      case "REPETITION":
      case "REPET":
        message = Minitel.keys.Videotex.Repetition;
        break;

      default:
        // Convert the string to a code sequence
        range(keyword.length).forEach((offset) => {
          message.push(keyword.charCodeAt(offset));
        });

        // Append the ENVOI key code sequence
        message = message.concat(Minitel.keys.Videotex.Envoi);
    }

    if (this.keyboard) this.keyboard.keypress(message);

    return false;
  }
};

/**
 * @file start-emulators.js
 * @author Frédéric BISSON <zigazou@free.fr>
 * @version 1.0
 *
 * Find and run any Minitel emulator in the current document.
 */

/**
 * @namespace Minitel
 */
var Minitel = Minitel || {};

Minitel.startEmulators = function () {
  const emulators = [];
  document
    .querySelectorAll("x-minitel")
    .forEach((container) => emulators.push(new Minitel.Emulator(container)));
  return emulators;
};
