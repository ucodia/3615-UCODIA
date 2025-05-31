import { Minitel } from "./minitel.js";
import { startServer } from "./server.js";
import { sliceExhibits } from "./slice/exhibits.js";
import { sliceWorkshops } from "./slice/workshops.js";
import { omeletteFacts } from "./slice/omelette.js";

const programs = [
  { title: "exhibits calendar", handoff: sliceExhibits },
  { title: "workshops calendar", handoff: sliceWorkshops },
  { title: "omelette facts", handoff: omeletteFacts },
];

// Welcome page handler
async function welcomePage(websocket) {
  const m = new Minitel(websocket);

  // Function to display the welcome page
  async function displayWelcome() {
    await m.home();
    await m.cls();
    await m.xdraw("screens/intro.vdt");
    // await new Promise((resolve) => setTimeout(resolve, 10 * 1000));

    await m.home();
    await m.cls();

    // Display title
    await m.pos(2, 13);
    await m.color(m.noir);
    await m.backcolor(m.blanc);
    await m.print(" 3615 SLICE ");
    await m.normal();

    // Display subtitle on two lines, centered
    const subtitle1 = "your slice of life news";
    const subtitle2 = "on minitel";

    // Calculate center positions (screen is 40 columns wide)
    const subtitle1Pos = Math.floor((40 - subtitle1.length) / 2);
    const subtitle2Pos = Math.floor((40 - subtitle2.length) / 2);

    // Display subtitles with a space between title and subtitle
    await m.pos(4, subtitle1Pos);
    await m.print(subtitle1);
    await m.pos(5, subtitle2Pos);
    await m.print(subtitle2);

    // Display menu from programs object
    let row = 8;
    for (let i = 0; i < programs.length; i++) {
      const key = programs[i];
      await m.pos(row, 10);
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
    const promptText = `select a program (${range}): `;
    await m.print(promptText);

    // Get input at the position right after the prompt text
    const [input, key] = await m.input(
      23,
      2 + promptText.length,
      1,
      "",
      " ",
      false
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
      await m.message(0, 1, 2, "invalid program");
      await m.del(23, 2 + promptText.length);
      await m.pos(23, 2 + promptText.length);
    }
  }
}

// Start the welcome page server
(async function () {
  startServer(omeletteFacts, 3615, "Welcome Page");
})().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
