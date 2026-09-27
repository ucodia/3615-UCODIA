# Photobooth page

Date: 2026-09-27. Project: 3615-UCODIA. Branch: `slice`.

## Goal

A Minitel page that takes a webcam shot on the server, shows it on the terminal through the image converter, lets the user cycle the looks, and publishes a Minitel-look PNG behind a QR code for five minutes.

## Decisions taken in chat

- Capture happens on the server with ffmpeg, spawned as a child process. The `ffmpeg-static` package supplies the binary on macOS and on the Pi; `PHOTOBOOTH_FFMPEG` can point at a system binary instead. Input is avfoundation on macOS and v4l2 on Linux.
- Resolution: the camera's modes are listed once at startup and the largest 4:3 mode up to 1920 wide is chosen, else the largest mode up to 1920 wide, else the device default. We downscale ourselves with the converter's pipeline; the camera's own scaler is not controllable. The first frames are black while the camera warms up, so frame 16 is kept (measured on the Mac: 2.3 s for a 1760 by 1328 shot).
- The picture covers rows 1 to 24 (40 by 24, 4:3). The hint bar is drawn over row 24 on the terminal only. The download is the clean 40 by 24 render.
- Download is the Minitel render as a PNG at 4x (1280 by 960), at `<PUBLIC_URL>/p/<hash>-<code>.png`, where `hash` is the first 7 hex characters of the SHA-256 of the captured JPEG and `code` is a short filter name (poster, photo, half, smooth, news, stripe, sketch, stencil, type) so a production url fits a version 3 QR code and, without its scheme, on one 40-column row (`slice.ucodia.space/p/a172089-stencil.png`). The QR page shows the caption on row 1, the code centred on rows 2 to 23 and the url on row 24. Amended 2026-09-27: the path was `/photobooth/` with full preset names and an 8-character hash. A file is written only when the user presses D. It expires 5 minutes after its last publish; re-publishing refreshes the clock and does not re-render.
- All presets are converted right after the capture and kept in memory for the session; the PNG is rendered on publish. Filter order: poster, photo, halftone, smooth, newsprint, stripes, sketch, stencil, typewriter.
- A 3, 2, 1 countdown precedes the shot.
- Keys: SPACE capture, F next filter, D download (only after a capture), SOMMAIRE leaves. Digits 4 to 0 and several letters are broken on the terminal, so the page is opened from the main menu with `P`.

## Modules

```
image/render.js            renderPng(cells, { scale }) -> Buffer   node twin of the playground's save .png, uses the emulator sprite sheets
photobooth/camera.js       Camera: probe(), capture() -> jpeg Buffer, serialised; ffmpeg args per platform
photobooth/store.js        PhotoStore: publish(name, png), get(name), sweep(), purge(); TTL and clock injectable
photobooth/config.js       env: PHOTOBOOTH_DEVICE, PHOTOBOOTH_FFMPEG, PUBLIC_URL, PHOTOBOOTH_TTL
slice/photobooth-screens.js  pure Screen builders: idle, bar, countdown digit, QR page, url fallback
slice/photobooth.js        createPhotobooth({ camera, store, publicUrl, makeMinitel }) -> handoff(ws)
slice/qr.js                gains an errorCorrectionLevel option
server.js                  GET /p/:name from the store; 404 when unknown or expired
index.js                   menu entry "P  photobooth"
```

## Page flow

1. **Idle.** Clear screen. "press space to capture" centred on row 12 in white. Bar on row 24: `SPACE` capture, `SOMMAIRE` menu, in the inverse-key style of the other pages.
2. **SPACE.** Ignore if a capture is in progress. Draw 3, then 2, then 1 as large mosaic digits centred on the black screen, one per second, then "smile" on row 12. Capture. Hash. Convert every preset at 40 by 24 (`convertField` on the shared pipeline, one `prepare` at each cell size, so two sharp passes, nine quantise passes). Show the current filter, starting at poster, and the full bar: `SPACE` capture, `F` filter, `D` download.
3. **F.** Advance to the next preset, wrapping. Redraw the picture and the bar. Notification on row 0 for two seconds: `applied <name> filter`.
4. **D.** Render the PNG for the current preset if not cached in the session, publish it, show the QR page: the code drawn in mosaic on rows 1 to 24, caption on row 0 `scan to download, 5 min`. Any key returns to the picture. If the URL is longer than 78 bytes (QR version 4 at level L), show the URL as text on rows 10 to 14 instead of a code.
5. **SOMMAIRE** leaves from any state; the session's captures are dropped. Any other key: `use keys at bottom of screen` on row 0.

## Camera

- `probe()` runs ffmpeg with an impossible size on macOS (`-video_size 1x1`) and parses the `Supported modes:` lines; on Linux it runs `-list_formats all` and parses `WxH` tokens. Failure to probe is logged and falls back to the device default (no `-video_size`).
- `capture()` runs `ffmpeg -f <input> [-framerate 30] [-pixel_format uyvy422 on macOS] [-video_size WxH] -i <device> -vf select=gte(n\,15) -fps_mode passthrough -frames:v 1 -q:v 3 -f image2pipe -vcodec mjpeg pipe:1` and returns stdout. A 15 second timeout kills the process. Concurrent calls queue behind one another.
- Errors reject with the ffmpeg stderr tail in the message.

## Store

- Directory `data/photobooth`, created on demand and purged at startup.
- `publish(name, png)` writes the file if absent and records `expires = now + ttl`. `get(name)` returns the path when known and unexpired, else `null` (and deletes the file if expired). `sweep()` deletes every expired entry; the server runs it every 60 seconds.
- Names are validated against `/^[0-9a-f]{7}-[a-z]+\.png$/` before touching the file system.

## Render

`renderPng(cells, { scale = 4 })` draws each cell from the emulator sprites: mosaic cells from `emulator/font/ef9345-g1.png` at ordinal `0x40 + bits`, text cells from `ef9345-g0.png` at the character code; lit sprite pixels take the foreground grey, others the background grey, using `LEVELS`. Output is `cols*8*scale` by `rows*10*scale`, greyscale PNG. Sprites are loaded once with sharp and cached.

## Configuration

| variable            | default                          |
|---------------------|----------------------------------|
| `PHOTOBOOTH_DEVICE` | `0` on macOS, `/dev/video0` else; on macOS an index or a device-name fragment such as `FaceTime`, since indexes shuffle when an iPhone connects |
| `PHOTOBOOTH_FFMPEG` | the `ffmpeg-static` binary       |
| `PUBLIC_URL`        | `http://localhost:3615`          |
| `PHOTOBOOTH_TTL`    | `300` seconds                    |

## Errors

Capture failure: log, `camera not available` on row 0 for three seconds, back to idle. Publish failure: `download not available`. Probe failure: log, default mode. Route: 404 for unknown, expired or malformed names, never a directory listing.

## Testing

`node:test`. Camera: args builders and mode parsing on captured ffmpeg output, `capture()` against a fake ffmpeg script that writes a JPEG to stdout, timeout path. Store: temp dir, injected clock, publish/get/expire/sweep/purge, name validation. Render: known cells against sprite pixels. Screens: layout assertions like the venables screen tests. Page: scripted key sequences through a stub Minitel and a fake camera, checking screen calls, publish calls and state transitions. Route: through `startServer`. A manual run on the Mac with the real camera and the emulator closes it.

## Out of scope

Live preview, printing, a landing page for downloads, retention beyond five minutes, the original JPEG being downloadable.
