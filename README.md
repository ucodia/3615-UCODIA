# 3615-UCODIA ☎️

The Internet of the future past 🌈

## Deploy

The service runs as a systemd service named `slice`. Node.js and npm must already be installed.

Install or update, from the repo as your regular user (the script calls `sudo` when needed):

```sh
git pull
./install.sh
```

This installs production dependencies (skipped when `package-lock.json` and the Node version are unchanged since the last install), writes `/etc/systemd/system/slice.service` pointing at this repo, enables it at boot and restarts it.

```sh
systemctl status slice       # state
journalctl -u slice -f       # live logs (also written to logs/)
sudo systemctl restart slice # restart
```

Uninstall:

```sh
sudo systemctl disable --now slice
sudo rm /etc/systemd/system/slice.service
sudo systemctl daemon-reload
```

## Image converter

`image/` turns a raster image into greyscale mosaic cells. Five looks are available as presets: `photo` (error diffusion), `poster` (no dither), `halftone` (Bayer), `newsprint` (black and white diffusion) and `stencil` (three tones).

Command line:

```sh
node bin/img2vdt.js photo.jpg --preset photo --cols 40 --rows 24 --out screens/photo.vdt
```

Playground: run `npm run dev` and open `http://localhost:3615/playground.html`. Drop, paste or pick an image, or start the webcam for a live feed, change settings and watch the result in the emulator. Loading an image stops the camera. The camera needs localhost or HTTPS. "Replay at 4800 baud" shows the reveal at link speed. The page uses `POST /api/vdt`, which takes a raw image body and the same options as the CLI as query parameters.

## Notes

### 2026-09-17 - Broken keyboard keys

The Minitel keyboard is failing progressively. Keys that no longer respond:

- Retour, Suite, Envoi
- 4 5 6 7 8 9 0 \* #
- Esc ; - :
- U I O
- Q S J K L M
- Up, Down, Left, Right

Temporary remaps until the keyboard is repaired:

| Page             | Action            | Original key        | Temporary key |
| ---------------- | ----------------- | ------------------- | ------------- |
| Main menu        | Venables Vibes    | 4                   | V             |
| Calendars        | Previous / next   | Retour / Suite, ← → | 1 / 3         |
| Omelette facts   | Close up          | Suite, →            | 3             |
| Venables Vibes   | Go west / go east | Retour / Suite, ← → | W / E         |
| Venables Vibes   | Show QR code      | Envoi               | 1             |

The original keys are still handled in code, so once the hardware is fixed only the on-screen labels and the main menu key need to be restored. New pages should only rely on keys that still work.