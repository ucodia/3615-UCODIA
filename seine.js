import { Minitel } from "./minitel.js";
import { startServer } from "./server.js";

// minitel version of 1951 artwork "seine" by kelly ellsworth
// made by lionel ringenbach / @ucodia
// created on 2025-03-10

const rows = 18; // original is 41
const columns = (rows + 1) * 2;

function generateGrid() {
  const grid = [];
  for (let x = 0; x < rows + 1; x++) {
    grid[x] = generateColumn(x);
    grid[columns - 1 - x] = generateColumn(x);
  }
  return grid;
}

function generateColumn(blackCells) {
  const column = new Array(rows).fill(false);
  while (blackCells > 0) {
    const index = randomInt(0, rows - 1);
    if (!column[index]) {
      column[index] = true;
      blackCells--;
    }
  }
  return column;
}

function randomInt(min, max, rand = Math.random) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

async function seine(websocket) {
  const m = new Minitel(websocket);

  // Initial setup
  await m.home();
  await displayArtwork(m);

  // Listen for ENVOI key to generate new artwork or SOMMAIRE to return to welcome page
  while (true) {
    const [_, key] = await m.input(24, 40, 0, "", " ", false);

    if (key === m.envoi) {
      break;
      await displayArtwork(m);
    } else if (key === m.sommaire) {
      break;
    }
  }
}

async function displayArtwork(m) {
  // Clear screen
  await m.cls();

  // Generate new grid
  const grid = generateGrid();

  // Center the artwork on screen (40x24)
  const startX = Math.floor((40 - columns) / 2) + 1;
  const startY = Math.floor((24 - rows) / 2) + 1;

  // Display the grid
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      await m.pos(startY + y, startX + x);
      if (grid[x][y]) {
        // Black cell
        await m.backcolor(m.noir);
        await m.print(" ");
      } else {
        // White cell
        await m.backcolor(m.blanc);
        await m.print(" ");
      }
    }
  }

  // Reset colors
  await m.normal();
}

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async function () {
    startServer((ws) => seine(ws), 3613, "Seine");
  })().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}

export { seine };
