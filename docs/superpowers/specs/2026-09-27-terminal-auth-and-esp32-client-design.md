# Terminal authentication, single configuration and ESP32 client — design

Date: 2026-09-27. Project: 3615-UCODIA (Minitel server for Slice of Life). Branch: photobooth.

## Problem

In the gallery a Minitel is driven by an ESP32 that connects as a websocket client to `wss://slice.ucodia.space`, a Cloudflare tunnel to the Pi standing next to it. The same host serves the browser emulator to the public. The server cannot tell the two apart, so anyone on the web can open the emulator, press `P` then space, and take pictures with the gallery webcam.

The client sketch lives in a clone of a third-party repository with the Wi-Fi passwords committed in a local commit, and the server's public URL is typed at install time. Configuration is spread over three places.

## Goals

- Only the gallery terminal can use the server webcam. Everything else the server offers stays public.
- The playground and the conversion endpoint behind it are reachable only from the local network, never through the tunnel.
- One configuration file, `.env` at the repository root, never committed, drives the server, the install script and the ESP32 firmware. A committed `.env.example` documents every key with dummy values.
- The ESP32 client code moves into this repository and is built and flashed with arduino-cli from documented commands.
- The Wi-Fi passwords disappear from git history everywhere.

## Non-goals

- Token rotation. The user accepts a fixed secret in firmware; changing it means editing `.env` and reflashing.
- Rate limiting or abuse control for public websocket connections.
- A browser-webcam photobooth for web visitors. Web visitors do not get the photobooth at all in this iteration.
- Cloudflare Access or a second tunnel route. Authentication happens inside the existing websocket handshake.

## Threat model

The attacker can reach `https://slice.ucodia.space` and everything Cloudflare forwards: the HTTP routes and the websocket. They cannot read the Pi's file system, the ESP32 flash or TLS traffic. The gallery LAN is trusted enough for the playground, not for the camera: the camera is gated by the token on every connection, LAN or tunnel.

What the token protects is the camera and the download store. A leaked token lets someone take pictures in the gallery; it does not expose anything else.

## Design

### 1. Configuration: `.env`

`.env` at the repository root, listed in `.gitignore`. `.env.example` is committed with placeholder values and a comment per key.

| key | required | meaning |
| --- | --- | --- |
| `PUBLIC_URL` | yes | Public base URL of the server, `https://slice.ucodia.space` in the gallery. The server builds download URLs from it; the ESP32 derives its websocket target from it: `https` means `wss` on port 443, `http` means `ws` on the URL's port (3615 when absent), so `http://minitelpi:3615` points a test terminal at the LAN server. |
| `TERMINAL_TOKEN` | yes for the camera | Shared secret, at least 32 characters, generated once with `openssl rand -hex 32`. The ESP32 presents it; connections presenting it are terminals. Unset or shorter than 32 characters: no connection is a terminal, the server logs a warning at startup and the photobooth is never offered. |
| `WIFI_SSID_1`, `WIFI_PASSWORD_1`, `WIFI_SSID_2`, ... | yes for the ESP32 | Networks tried in order at boot and after a Wi-Fi loss, as the sketch does today. Numbering starts at 1 and stops at the first missing SSID. |
| `PHOTOBOOTH_DEVICE`, `PHOTOBOOTH_FFMPEG`, `PHOTOBOOTH_TTL` | no | Unchanged from the photobooth spec, listed in the example for completeness. |

The server loads the file itself with Node's `--env-file-if-exists=.env` flag (Node 22.9 or later; the Pi runs 22.23 and the Mac 22.14, and the README states the floor). No dotenv dependency. Both `npm start` and `npm run dev` pass the flag; nodemon runs `node` through `--exec`. Shell variables still win over the file, which keeps the existing tests and one-off overrides working.

The install script no longer prompts for anything. It refuses to run when `.env` is missing or `PUBLIC_URL` is empty, warns when `TERMINAL_TOKEN` is missing, and writes the unit with `ExecStart=<node> --env-file-if-exists=.env index.js` and no `Environment=PUBLIC_URL` line. The `NODE_ENV=production` line stays.

### 2. Terminal authentication

The ESP32 offers `TERMINAL_TOKEN` as the websocket subprotocol (`Sec-WebSocket-Protocol` on the upgrade request). The sketch already has a `protocol` variable passed to `beginSSL`, so the client change is configuration only.

Server side, `startServer` gains a `terminalToken` option. The `WebSocketServer` is created with `handleProtocols(protocols, req)`: when the token is set and one of the offered protocols equals it, that protocol is selected, which marks the connection; otherwise no protocol is selected and the connection proceeds as a public one. Comparison uses `crypto.timingSafeEqual` on equal-length buffers; a length mismatch is a mismatch. A connection that offered protocols but matched none is logged once at warn level with its client IP.

The connection handler calls `serviceHandler(ws, req, { terminal })` where `terminal` is `ws.protocol === terminalToken` (ws sets `ws.protocol` to the selected subprotocol). Every existing page keeps its signature; only the welcome page reads the flag.

The welcome page builds its program list from `programsFor(terminal)`: the photobooth entry is present only when `terminal` is true. On a public connection the menu shows four entries, the prompt lists four keys, and `P` is handled like any unknown key. The photobooth page function is never constructed for a public connection, so no code path from the web reaches `Camera.capture` or the store.

Browsers do not send a subprotocol, so the emulator page is unaffected. Wrong or missing tokens never reject the connection: public visitors are the normal case, and rejecting would leak nothing useful anyway.

### 3. Playground restricted to the local network

Requests that arrive through the tunnel carry Cloudflare's `cf-connecting-ip` header, which the server already reads for logging; Cloudflare sets it at the edge and overwrites any client-supplied value. Requests from localhost or the LAN do not carry it.

`server.js` installs one middleware ahead of the static mounts that answers 404 to tunnel requests for `/playground.html`, anything under `/lib/`, and `POST /api/vdt`. The emulator page, its library, fonts, sounds and the download route stay public. The README states that the playground is a local tool at `http://localhost:3615/playground.html`.

### 4. ESP32 client in the repository

Layout:

```
esp32/
  client/
    client.ino        the sketch, from Minitel1B_Websocket_Client.ino
    config.h          generated from .env, git-ignored
  README.md           arduino-cli setup and the build and flash commands
bin/esp32-config.js   writes esp32/client/config.h from .env
```

Arduino tooling requires the folder and the main sketch file to share a name, hence `esp32/client/client.ino` rather than a bare `esp32/client.ino`.

The sketch is the current one with the configuration block replaced by `#include "config.h"`. The generated header defines `WS_HOST`, `WS_PORT`, `WS_SSL`, `WS_PATH` (`/`), `WS_PROTOCOL` (the token, empty when unset) and the `networks[]` array with its count, using the same names the sketch uses today. Everything else in the sketch, Minitel setup, reconnect loops, keyboard forwarding and event handling, is unchanged. Debug output never prints the token or the Wi-Fi passwords.

`bin/esp32-config.js` parses `.env` (key=value lines, `#` comments, optional double quotes, no interpolation), derives the websocket target from `PUBLIC_URL`, collects the numbered networks, refuses to run when `PUBLIC_URL` or `WIFI_SSID_1` is missing, escapes backslashes and double quotes in string literals, and writes the header. It is run by `npm run esp32:config`, and the build and flash scripts run it first.

`package.json` scripts, with the board name in one place:

```
esp32:config   node bin/esp32-config.js
esp32:build    npm run esp32:config && arduino-cli compile --fqbn esp32:esp32:esp32 esp32/client
esp32:flash    npm run esp32:build && arduino-cli upload --fqbn esp32:esp32:esp32 -p ${ESP32_PORT:-/dev/cu.usbserial-0001} esp32/client
esp32:monitor  arduino-cli monitor -p ${ESP32_PORT:-/dev/cu.usbserial-0001} -c baudrate=115200
```

`ESP32_PORT` is a shell variable, not a `.env` key, since it names a socket on the flashing machine. `esp32/README.md` covers: installing arduino-cli with Homebrew, `arduino-cli config init`, adding the Espressif board index URL, `arduino-cli core install esp32:esp32`, installing the `WebSockets` (Links2004) and `Minitel1B_Hard` libraries from the library manager, finding the serial port with `arduino-cli board list`, the three npm commands, and what the serial monitor prints on a good connection. The root README links to it and gains a Configuration section describing `.env`.

### 5. Removing the secrets from history

In the Minitel-ESP32 clone, the branch `password-protection` holds the only commit containing the passwords. After the sketch is copied here, that branch is deleted, the reflog expired and the repository garbage-collected so the commit is unrecoverable locally. The clone is left on `main`, tracking upstream, with no local changes. This repository never receives the passwords: `.env` is ignored before it is created, and the plan's first task adds the ignore rule.

Changing the two Wi-Fi passwords themselves is recommended but is the user's call and outside the plan.

## Testing

- `handleProtocols`: selects the token when offered, ignores other protocols, rejects near-misses (prefix, different length, different case), does nothing when the token is unset. Unit test on the exported function.
- Connection flag: a websocket client offering the token sees the photobooth entry on the welcome screen, a client without it sees four entries and `P` behaves as an unknown key. Integration test on `startServer` with a fake service handler asserting the `terminal` argument, plus a unit test on `programsFor`.
- Playground guard: with a `cf-connecting-ip` header, `/playground.html`, `/lib/screen.js` and `POST /api/vdt` return 404 while `/` and `/library/minitel.js` still serve; without the header everything serves as before. Extends the existing api tests.
- Config generator: a fixture `.env` produces the expected header (host, port and ssl for an `https` and an `http` URL, the networks array, escaping of quotes); missing `PUBLIC_URL` or `WIFI_SSID_1` exits non-zero with a message.
- Install script: `bash -n`, plus a dry run that checks it refuses without `.env`.
- Sketch: `arduino-cli compile` on a generated header is the check; no unit tests. The plan ends with a real flash and a connection to the LAN server showing the photobooth entry, then to the public host.

## Files touched

```
.env.example                          new
.gitignore                            .env and esp32/client/config.h
package.json                          start and dev with --env-file-if-exists, esp32:* scripts
server.js                             terminalToken option, handleProtocols, terminal flag, playground guard
index.js                              programsFor(terminal), passes the flag from the handler
install.sh                            .env checks, no prompt, ExecStart with the env flag
bin/esp32-config.js                   new
esp32/client/client.ino               new, from the Minitel-ESP32 clone
esp32/README.md                       new
README.md                             Configuration section, security note, playground is local, link to esp32/README.md
test/server-auth.test.js              new
test/esp32-config.test.js             new
test/api.test.js                      playground guard cases
```
