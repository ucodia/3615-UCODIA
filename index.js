import { Minitel } from "./minitel.js";
import { startServer } from "./server.js";
import { sliceExhibits } from "./slice/exhibits.js";
import { sliceWorkshops } from "./slice/workshops.js";
import { omeletteFacts } from "./slice/omelette.js";
import { seine } from "./seine.js";
import logger from "./logger.js";

const programs = [
  { title: "exhibits calendar", handoff: sliceExhibits },
  { title: "workshops calendar", handoff: sliceWorkshops },
  { title: "omelette facts", handoff: omeletteFacts },
  { title: "???", handoff: seine },
];

// Welcome page handler
async function welcomePage(websocket) {
  const m = new Minitel(websocket);

  // Function to display the welcome page
  async function displayWelcome() {
    logger.info("Navigating to welcome page");
    await m.home();
    await m.cls();
    await m.xdraw("screens/slice.vdt");

    // content
    let row = 15;
    for (let i = 0; i < programs.length; i++) {
      const key = programs[i];
      await m.pos(row, 2);
      await m.print(`${i + 1} - ${key.title}`);
      row += 2;
    }
  }

  // Display the welcome page
  await displayWelcome();

  // Handle user input
  while (true) {
    // Display instruction on before last row (row 23) and position cursor right after
    await m.pos(23, 2);
    // Create a range string like "1-3" based on number of programs
    const range = programs.length > 1 ? `1-${programs.length}` : "1";
    const promptText = `select an option (${range}): `;
    await m.print(promptText);

    // Get input at the position right after the prompt text
    const [input, key] = await m.input(
      23,
      2 + promptText.length,
      1,
      "",
      " ",
      false,
    );

    if (
      key === m.envoi &&
      input &&
      parseInt(input) >= 1 &&
      parseInt(input) <= programs.length
    ) {
      const programIndex = parseInt(input) - 1;
      await m.cls();
      await programs[programIndex].handoff(websocket);
      await displayWelcome();
    } else {
      await m.message(0, 1, 2, "Invalid option", true);
      await m.del(23, 2 + promptText.length);
      await m.pos(23, 2 + promptText.length);
    }
  }
}

// Start the welcome page server
(async function () {
  startServer(welcomePage, 3615);
})().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
