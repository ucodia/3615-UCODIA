# 3615-UCODIA ☎️

The Internet of the future past 🌈

## Deploy

The service runs as a systemd service named `slice`. Node.js and npm must already be installed.

Install or update, from the repo as your regular user (the script calls `sudo` when needed):

```sh
git pull
./install.sh
```

This installs production dependencies (skipped when `package-lock.json` and the Node version are unchanged since the last install), checks that `.env` exists with a `PUBLIC_URL`, writes `/etc/systemd/system/slice.service` pointing at this repo and loading `.env`, enables it at boot and restarts it.

```sh
systemctl status slice       # state
journalctl -u slice -f       # live logs (also written to logs/, see Logs)
sudo systemctl restart slice # restart
```

Uninstall:

```sh
sudo systemctl disable --now slice
sudo rm /etc/systemd/system/slice.service
sudo systemctl daemon-reload
```

## Image converter

`image/` turns a raster image into greyscale Minitel cells. Eight looks are available as presets: `photo` (error diffusion), `poster` (no dither), `halftone` (Bayer), `newsprint` (blue-noise dither in black and white), `stencil` (three tones), `stripes` (ink stripes that grow with darkness), `sketch` (edge magnitude, no dither), `typewriter` (the Minitel character set as grey text on black) and `smooth` (3x3 median then poster). Presets bundle a method (`flat`, `diffuse`, `bayer`, `noise`, `dot`, `text`), a palette, a tone weight and a filter (`none`, `edges`, `median`); each can be overridden.

Command line:

```sh
node bin/img2vdt.js photo.jpg --preset photo --cols 40 --rows 24 --out screens/photo.vdt
node bin/img2vdt.js photo.jpg --preset poster --filter edges --palette 0,7 --out screens/outline.vdt
```

Playground: run `npm run dev` and open `http://localhost:3615/playground.html`. Drop, paste or pick an image, or start the webcam for a live feed, change settings and watch the result in the emulator. Loading an image stops the camera. Conversion runs in the browser with the same `image/` modules node uses, except that a canvas does the resampling instead of sharp; tick "server" to convert through `POST /api/vdt` instead and compare. That endpoint takes a raw image body and the same options as the CLI as query parameters. Colour is reduced to grey with Rec. 601 luminance on both sides. "Replay at 4800 baud" shows the reveal at link speed. The camera needs localhost or HTTPS.

## Configuration

Copy `.env.example` to `.env` and fill it in. The file is ignored by git and read by the server (`npm start`, `npm run dev` and the service load it with Node's `--env-file-if-exists`, Node 22.9 or later), by `install.sh` and by the ESP32 build. Shell variables override it.

| key | meaning |
| --- | --- |
| `PUBLIC_URL` | public base URL, used for download links and as the ESP32's websocket target |
| `TERMINAL_TOKEN` | shared secret the ESP32 presents as its websocket subprotocol; at least 32 characters, `openssl rand -hex 32` |
| `WIFI_SSID_n`, `WIFI_PASSWORD_n` | networks the ESP32 tries in order, numbered from 1 |
| `PHOTOBOOTH_*` | optional, see the photobooth section |
| `IDLE_SECONDS` | `180`. Seconds without a key before the attract screen; keep it under the terminal's own standby of four to five minutes |
| `KEEPALIVE_SECONDS` | `30`. Interval of the ignored byte sent while a page is in use so the terminal never blanks; `0` disables it |

A Minitel 1B turns its screen off after four to five minutes without received data or a key press. After `IDLE_SECONDS` without a key the server abandons the current page and shows an animated "press any key" screen, which also keeps the terminal awake; any key returns to the welcome page. While a page is in use a NUL goes out every `KEEPALIVE_SECONDS` so the screen stays on.

To test the terminal pages from a browser, open the emulator with the token in the url, `http://localhost:3615/?token=<TERMINAL_TOKEN>`: the page offers it as the websocket subprotocol and the server treats that browser as the terminal. Outside production the server prints that url at startup. The token then sits in the browser history, so do this on your own machine only.

### Who gets what

The emulator page and the download route are public. A websocket connection presenting `TERMINAL_TOKEN` is the gallery terminal and the only one whose photobooth uses the server webcam, so the camera next to the Minitel can only be triggered from the Minitel. Everyone else gets the photobooth on their own browser camera: the emulator sends a 320 by 240 block of raw pixels, which the server checks by length and never decodes, so no image parser ever runs on visitor data. Websocket messages are capped at 512 KB. An ESP32 connecting without its token is treated as a public visitor: it sees the menu, and its photobooth ends in "camera not available" since the firmware ignores the binary control bytes. The playground, the `/lib` modules and `POST /api/vdt` are local tools: requests arriving through the Cloudflare tunnel (they carry `cf-connecting-ip`) get a 404, so they work at `http://localhost:3615` and on the LAN only. This assumes the tunnel is the only public path to the server.

## Photobooth

Menu key `P`. The server takes a still from the webcam with ffmpeg (the `ffmpeg-static` package ships the binary for macOS and Linux arm64), converts it to every look, and shows it on the Minitel. Keys: `SPACE` capture (after a 3, 2, 1 countdown), `F` next filter (poster, photo, halftone, newsprint, stripes, typewriter), `D` download, `SOMMAIRE` back to the menu. `D` renders the current look as a 1280 by 960 PNG, publishes it for five minutes and shows a QR code pointing at `PUBLIC_URL/p/<hash>-<code>.png`, where the hash is the first 7 hex characters of the SHA-256 of the shot and the code is a short filter name (`poster`, `photo`, `half`, `news`, `stripe`, `type`). Files live in `data/photobooth` and are purged at startup.

On the browser emulator the picture comes from the visitor's camera. The browser asks for permission when the photobooth page opens; a refusal or a missing camera shows "camera not available" after the countdown. The camera is released when the page is left.

| variable            | default                                   |
|---------------------|-------------------------------------------|
| `PHOTOBOOTH_DEVICE` | `0` on macOS, `/dev/video0` on Linux. On macOS an index or a name fragment such as `FaceTime` |
| `PHOTOBOOTH_FFMPEG` | the `ffmpeg-static` binary                |
| `PUBLIC_URL`        | `http://localhost:3615`                   |
| `PHOTOBOOTH_TTL`    | `300` seconds                             |
| `PHOTOBOOTH_GAMMA`  | `1`. Below 1 lifts the mid-tones before quantising, `0.75` suits faces against a bright background |
| `PHOTOBOOTH_CONTROLS` | none. Comma-separated v4l2 controls applied with `v4l2-ctl` before each shot on Linux, e.g. `backlight_compensation=1` |
| `PHOTOBOOTH_DUMP`   | unset. A directory that receives the raw JPEG of every capture as `<hash>.jpg`, for tuning; leave unset in normal operation |

The gallery terminal is an ESP32 bridging the Minitel to this server. Its firmware lives in [`esp32/`](esp32/README.md) and is configured from the same `.env`.

At startup the camera's modes are listed and the largest 4:3 mode up to 1920 wide is used. On a Pi, add the service user to the `video` group so `/dev/video0` is readable.

## Logs

The server writes one JSON object per line to `logs/YYYY-MM-DD.jsonl`. A new file starts at local midnight and the previous day is gzipped to `.jsonl.gz`. Nothing is deleted. The console, and so `journalctl`, shows the same lines as text, `info page sid=a3f09c client=minitel page=photobooth`, without the timestamp under systemd since journald adds its own.

```json
{"ts":"2026-10-05T15:48:50.123-07:00","level":"info","msg":"page","sid":"a3f09c","client":"minitel","page":"photobooth"}
```

This format is the contract: anything that writes these lines keeps the report working.

- `ts`: local time with the UTC offset, in the system time zone (`America/Vancouver` on the gallery Pi). Parse it before comparing two lines; string order breaks in the hour clocks fall back.
- `level`: `error`, `warn`, `info` or `debug`. Debug lines are written nowhere unless the level in `logger.js` is lowered.
- `msg`: a name from the table below, never a sentence.
- `sid` and `client`: on every line written while serving a websocket connection. `sid` is 6 hex characters per connection; `client` is `minitel` for the connection presenting `TERMINAL_TOKEN`, `emulator` otherwise.
- Fields that do not apply are left out. Errors carry `error` and `stack`. IP addresses appear only on `subprotocol_rejected` and `local_only_refused`.

| msg | level | fields |
| --- | --- | --- |
| `start` | info | url, camera, idle_s, keepalive_s, commit |
| `connect`, `disconnect` | info | sid, client; `disconnect` adds seconds |
| `page` | info | sid, client, page, view, n |
| `invalid_option` | info | sid, client, key |
| `attract` | info | sid, client |
| `capture` | info | sid, client, hash |
| `publish` | info | sid, client, hash, filter |
| `landing` | info | via (`tunnel` or `lan`) |
| `download` | info | hash, filter |
| `download_missing` | info | name, cut to 200 characters (a photo link with no picture behind it, expired or never published) |
| `terminal_url` | info | url (outside production) |
| `camera_probe_failed`, `token_missing`, `store_purge_failed`, `store_sweep_failed`, `capture_failed`, `publish_failed`, `dump_failed`, `events_fetch_failed`, `screen_load_failed`, `marquee_failed`, `vdt_rejected` | warn | error, and file or url where it applies |
| `subprotocol_rejected`, `local_only_refused` | warn | ip; `local_only_refused` adds path |
| `page_error`, `ws_error`, `server_error` | error | error, stack |
| `not_found`, `events_cache`, `ping` | debug | path; url and hit; clients |

| page | view | n |
| --- | --- | --- |
| `welcome` | | |
| `exhibits`, `workshops` | | page number |
| `omelette` | `facts` or `gallery` | gallery picture |
| `venables` | `map` or `qr` | map page |
| `photobooth` | | |

The Minitel's connection stays open for days, so a visit is the run of pages between a `connect` or an `attract` and the next `attract` or `disconnect`. Its length runs from its first page to its last.

### Usage report

```sh
npm run stats                          # all history in logs/
npm run stats -- --since 2026-10-10    # from that day
npm run stats -- ~/omelette-logs       # a copy of another machine's logs/
```

It reads `*.jsonl` and `*.jsonl.gz` in the folder, not its subfolders, and prints Minitel visits and their length, programs by visit, invalid menu entries, the photobooth from capture to download (each picture and filter counted once however often it is fetched), emulator landings and visits, errors and warnings, and a table per day.

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