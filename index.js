import { Minitel } from "./minitel.js";
import { startServer } from "./server.js";
import { sliceSchedule } from "./slice/schedule.js";
import { omeletteFacts } from "./slice/omelette.js";
import { venablesVibes } from "./slice/venables.js";
import logger from "./logger.js";

const programs = [
  { key: "1", title: "exhibits calendar", handoff: (ws) => sliceSchedule(ws, "exhibits") },
  { key: "2", title: "workshops calendar", handoff: (ws) => sliceSchedule(ws, "workshops") },
  { key: "3", title: "omelette facts", handoff: omeletteFacts },
  { key: "V", title: "venables vibes", handoff: venablesVibes },
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
    for (const program of programs) {
      await m.pos(row, 2);
      await m.inverse();
      await m.print(program.key);
      await m.inverse(0);
      await m.print(` - ${program.title}`);
      row += 2;
    }
  }

  // Display the welcome page
  await displayWelcome();

  // Handle user input
  while (true) {
    // Display instruction on before last row (row 23) and position cursor right after
    await m.pos(23, 2);
    const promptText = `select an option (${programs.map((p) => p.key).join(",")}): `;
    await m.print(promptText);

    // Get input at the position right after the prompt text
    const [input, key] = await m.input(
      23,
      2 + promptText.length,
      1,
      "",
      " ",
      false,
      true,
    );

    const program =
      key === m.envoi &&
      programs.find((p) => p.key === input?.trim().toUpperCase());

    if (program) {
      await m.cls();
      await program.handoff(websocket);
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
