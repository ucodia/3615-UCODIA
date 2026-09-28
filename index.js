import { Minitel, IdleError, ClosedError } from "./minitel.js";
import { startIdle, runAttract } from "./slice/attract.js";
import { startServer } from "./server.js";
import { sliceSchedule } from "./slice/schedule.js";
import { omeletteFacts } from "./slice/omelette.js";
import { venablesVibes } from "./slice/venables.js";
import { createPhotobooth } from "./slice/photobooth.js";
import { Camera } from "./photobooth/camera.js";
import { PhotoStore } from "./photobooth/store.js";
import { photoboothConfig } from "./photobooth/config.js";
import { programsFor } from "./slice/menu.js";
import { terminalToken, idleConfig } from "./config.js";
import logger from "./logger.js";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { mkdir, writeFile } from "fs/promises";

const config = photoboothConfig();
const idle = idleConfig();
const camera = new Camera({ ffmpeg: config.ffmpeg, device: config.device, controls: config.controls });
const dump = config.dump
  ? async (jpeg, hash) => {
      const dir = resolve(config.dump);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${hash}.jpg`), jpeg);
    }
  : null;
const photoStore = new PhotoStore({
  dir: join(dirname(fileURLToPath(import.meta.url)), "data", "photobooth"),
  ttlMs: config.ttl * 1000,
});

const allPrograms = [
  { key: "1", title: "exhibits calendar", handoff: (ws) => sliceSchedule(ws, "exhibits") },
  { key: "2", title: "workshops calendar", handoff: (ws) => sliceSchedule(ws, "workshops") },
  { key: "3", title: "omelette facts", handoff: omeletteFacts },
  { key: "V", title: "venables vibes", handoff: venablesVibes },
  { key: "P", title: "photobooth", terminalOnly: true, handoff: createPhotobooth({ camera, store: photoStore, publicUrl: config.publicUrl, ttl: config.ttl, gamma: config.gamma, dump }) },
];

// Welcome page handler
async function welcomePage(websocket, req, { terminal = false } = {}) {
  const m = new Minitel(websocket);
  const programs = programsFor(allPrograms, { terminal });
  const watch = () => startIdle(m, { ...idle, onIdle: () => m.cancelRead(new IdleError()) });
  let watchdog = watch();
  websocket.on("close", () => m.close());

  // Function to display the welcome page
  async function displayWelcome() {
    logger.info("Navigating to welcome page");
    await m.home();
    await m.cls();
    await m.xdraw("screens/slice.vdt");

    // content
    let row = 13;
    for (const program of programs) {
      await m.pos(row, 2);
      await m.inverse();
      await m.print(program.key);
      await m.inverse(0);
      await m.print(` - ${program.title}`);
      row += 2;
    }
  }

  try {
    // Display the welcome page
    await displayWelcome();

    // Handle user input
    while (true) {
      try {
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
      } catch (error) {
        if (!(error instanceof IdleError)) throw error;
        logger.info("Idle: attract screen");
        watchdog.stop();
        await runAttract(m);
        watchdog = watch();
        await displayWelcome();
      }
    }
  } catch (error) {
    if (!(error instanceof ClosedError)) throw error;
    logger.info("Connection closed");
  } finally {
    watchdog.stop();
  }
}

// Start the welcome page server
(async function () {
  try {
    await photoStore.purge();
  } catch (error) {
    logger.warn(`Photobooth store purge failed: ${error.message}`);
  }
  try {
    const mode = await camera.probe();
    logger.info(`Photobooth camera ${config.device}: ${mode ? `${mode.width}x${mode.height}` : "default mode"}`);
  } catch (error) {
    logger.warn(`Photobooth camera probe failed: ${error.message}`);
  }
  const token = terminalToken();
  if (!token) logger.warn("TERMINAL_TOKEN is unset or shorter than 32 characters: no connection can use the photobooth");
  logger.info(`Attract screen after ${idle.idleMs / 1000} s idle, keep-alive every ${idle.keepaliveMs / 1000} s`);
  startServer(welcomePage, 3615, { photoStore, terminalToken: token, publicUrl: config.publicUrl });
  if (token && process.env.NODE_ENV !== "production") {
    logger.info(`Emulator as the terminal (token in the url, not logged in production): ${config.publicUrl}/?token=${token}`);
  }
})().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
