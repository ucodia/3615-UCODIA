# Browser photobooth — design

Date: 2026-09-28. Project: 3615-UCODIA (Minitel server for Slice of Life). Branch: slice.

## Problem

The photobooth is offered only to the gallery terminal, because the server webcam must not be reachable from the web. Web visitors using the browser emulator see four menu entries and no photobooth. Their browser has a camera of its own, and the emulator already runs the image pipeline's browser counterpart in the playground, so the same program could serve them with their own picture.

Two things must stay true. The server webcam stays unreachable from any public connection, and the server never parses bytes a visitor sends: this repository is public and the gallery server runs on a network the operator does not own, so decoding visitor images with a native library is a surface the project does not want.

## Goals

- A public connection gets the photobooth entry `P` with the same pages, countdown, filters, notifications and QR download as the terminal.
- The picture comes from the visitor's browser camera. The emulator asks for camera permission when the photobooth page opens, not in the middle of the countdown.
- A refused permission or a missing camera lands on the existing "camera not available" notification, with no new path.
- The server checks the visitor's frame by length only. No image format is decoded server side for public connections.
- The ESP32 firmware and the terminal path are unchanged in behaviour and in bytes on the wire.

## Non-goals

- Rate limiting or abuse control. The operator accepts the traffic a public photobooth brings.
- Browser-side conversion. The browser sends pixels; the server keeps doing the conversion, so the output is identical to the terminal's.
- A different download for the web. The QR page stays; on a browser the visitor scans it from the screen like anyone else.
- Emulator tests. The emulator has no test harness; its side is checked by hand.

## Threat model

The attacker can open a websocket to the public host and send anything. They cannot present the terminal token. What the design guarantees against them: no code path from a public connection reaches the webcam `Camera`, nothing they send is passed to an image decoder, no message they send is larger than the websocket server's payload cap, and nothing they send becomes a file name (photo names are the hash of the bytes plus a filter code). A visitor's pixels are stored as PNGs in the photo store for the configured TTL, as terminal pictures are.

## Design

### 1. Wire protocol

Today the socket carries only text frames: videotex bytes down, keystrokes up. The rule for the photobooth traffic is that text stays the terminal and binary is the photobooth. The ESP32 and the current emulator never send or receive binary frames, so they are unaffected.

Server to emulator, one byte each:

| byte | meaning |
| --- | --- |
| `0x01` | camera on: the photobooth page opened, ask for the camera |
| `0x02` | capture: send the current frame now |
| `0x03` | camera off: the photobooth page closed, release the camera |

Emulator to server, one message per capture request:

- the frame: exactly `320 × 240 × 3 = 230400` bytes of RGB, row-major, top-left first, not mirrored;
- or an empty binary message: no camera (permission refused, no device, or the page has no photobooth support).

320 × 240 is `COLS × 8` by `ROWS × 10`, the crop size `image/prepare.js` already produces before resampling to the cell grid, so the server pipeline is entered at the point where it handles raw pixels today.

### 2. Server

**`photobooth/browser-camera.js`**, new. `BrowserCamera({ websocket, timeoutMs = 10000, width = 320, height = 240 })` exposes the same `capture()` as the webcam `Camera`, plus `open()` and `close()`:

- `open()` sends `0x01`, `close()` sends `0x03`. Both are fire-and-forget.
- `capture()` sends `0x02`, then resolves with the next binary message from the socket when its length is `width × height × 3`, rejects with an `Error("no camera")` on an empty message, `Error("bad frame")` on any other length, and `Error("camera timeout")` after `timeoutMs`. One capture is in flight at a time; a second call while one is pending rejects. The listener is removed on every exit.
- The result is a `Buffer` tagged for the pipeline: `{ data, raw: { width, height, channels: 3 } }`.

The webcam `Camera` gains `open()` and `close()` as no-ops so the photobooth page calls them without knowing which camera it has.

**`image/prepare.js`**: `prepare(source, cols, rows, options)` accepts `source` as a Buffer, as today, or as `{ data, raw }`; in the second form `sharp(data, { raw })` opens the pipeline with no decoder. `limitInputPixels` stays for the Buffer form. The resize to `cols × 8` by `rows × 10` is an identity on a frame of that size, so the two-pipeline structure is unchanged.

**`slice/photobooth.js`**: `convertAll(source, options)` passes the source through unchanged, so a tagged frame reaches `prepare` as is. `hashOf` hashes `source.data ?? source`. The page calls `camera.open()` after the idle screen is first shown and `camera.close()` in its existing `finally`, next to the notification timer. Capture errors already fall into the catch that shows the idle screen and "camera not available"; nothing changes there.

**`minitel.js`**: the per-read `onmessage` and the activity listener ignore binary messages. The `ws` library reports `isBinary` on the `message` event; the reader uses `websocket.on("message", (data, isBinary) => ...)` instead of `onmessage`, and only text reaches the key buffer. Binary frames still count as activity for the idle timer.

**`server.js`**: `new WebSocketServer({ ..., maxPayload: 512 * 1024 })`. `ws` closes a connection that sends a larger message with code 1009 before delivering it. The cap leaves room for one frame plus framing and nothing else.

**`index.js`**: the webcam `Camera` and the terminal photobooth are built as today. A second photobooth entry for public connections is built per connection, since the browser camera holds the socket:

```js
{ key: "P", title: "photobooth", handoff: (ws) => createPhotobooth({ camera: new BrowserCamera({ websocket: ws }), store: photoStore, publicUrl: config.publicUrl, ttl: config.ttl })(ws) }
```

`programsFor` picks the terminal entry for terminal connections and the browser entry for the others; `terminalOnly` becomes `terminal: true | false` on the two photobooth entries, with entries that have no flag offered to everyone. The public photobooth uses gamma 1 and no dump: `PHOTOBOOTH_GAMMA` and `PHOTOBOOTH_CONTROLS` describe the gallery webcam, and the dump writes JPEGs the browser path does not have.

The isolation property is expressed in code, not convention: the webcam `Camera` instance is referenced only by the terminal entry, and a test builds the program list for a public connection with a webcam stub whose `capture()` fails the test.

### 3. Emulator (`emulator/library/minitel.js`)

The socket's `onmessage` gains a branch: when `messageEvent.data` is a `Blob` (binary), it is handled by the photobooth support; text goes to the decoder as today. `binaryType` stays `"blob"`; the byte is read with `arrayBuffer()`.

- **Camera on**: `navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })`, the stream attached to a detached `<video>` element that is played. Failure of any kind, including a missing `mediaDevices` on an insecure origin, leaves the stream unset.
- **Capture**: with a stream, draw the current video frame onto a 320 × 240 canvas with the same centre cover crop as `prepareCanvas` in `image/prepare-browser.js`, read the `ImageData`, drop the alpha channel into a `Uint8Array(230400)` and send it. Without a stream, send an empty `Uint8Array`.
- **Camera off**: stop every track and drop the stream and the video element, so the browser's recording indicator goes out.
- Socket close also stops the tracks.

The frame is sent unmirrored; the server pipeline mirrors as it does for the gallery, so the visitor sees themself the same way the terminal visitor does.

### 4. Configuration and docs

No new keys. `README.md`: the photobooth paragraph says web visitors use their browser camera, that the server never decodes visitor images, and that the camera prompt appears when the photobooth page opens. The "Who gets what" section drops the line saying the photobooth is terminal-only.

## Testing

- `test/browser-camera.test.js`, new, with a stub websocket: `open()` and `close()` send the right byte; `capture()` sends `0x02`, resolves with a tagged frame on a message of 230400 bytes, rejects on an empty message, on a wrong length, and after the timeout with short delays; a text message during a capture is ignored; a second capture while one is pending rejects; the listener is gone after each outcome.
- `test/prepare.test.js` (or the existing image tests): a raw 320 × 240 source and the same image encoded as PNG produce identical fields.
- `test/minitel-read.test.js`: a binary message between two keys is skipped by `key()`; a binary message updates `lastActivity`.
- `test/server-auth.test.js` or `test/api.test.js`: a client sending a message above the cap is closed with 1009; a public connection's program list contains a photobooth whose camera is a `BrowserCamera`; the webcam stub is never called for a public connection.
- `test/menu.test.js`: `programsFor` selects by the `terminal` flag and keeps unflagged entries for both.
- `test/photobooth.test.js`: `open()` is called once the idle screen is shown and `close()` on exit, including exit through a cancelled read; a capture rejection shows "camera not available".
- By hand in the browser: permission prompt on entering `P`, picture after the countdown, all filters, QR page, refusal shows the notification, camera indicator goes out on SOMMAIRE.

## Files touched

```
photobooth/browser-camera.js       new
photobooth/camera.js               open() and close() no-ops
image/prepare.js                   raw source form
slice/photobooth.js                convertAll and hashOf accept the tagged frame; open/close calls
slice/menu.js                      terminal flag selection
minitel.js                         binary messages skipped by the reader
server.js                          maxPayload
index.js                           public photobooth entry with BrowserCamera
emulator/library/minitel.js        binary branch, camera on/capture/off
README.md                          photobooth for web visitors
test/browser-camera.test.js        new
test/minitel-read.test.js          binary skip
test/menu.test.js                  terminal flag
test/photobooth.test.js            open/close, rejection path
test/server-auth.test.js           payload cap, public entry, isolation
image tests                        raw source equivalence
```
