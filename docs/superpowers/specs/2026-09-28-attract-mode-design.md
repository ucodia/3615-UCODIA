# Attract mode and keep-alive — design

Date: 2026-09-28. Project: 3615-UCODIA (Minitel server for Slice of Life). Branch: photobooth.

## Problem

A Minitel 1B puts its screen to sleep after four to five minutes without received data or a key press, showing a dark tube with no hint that a key wakes it. In the gallery that reads as "broken". An earlier proof of concept (branch `screensaver`, commit 5c50918) drew a screensaver from inside the Minitel I/O class after 180 s of idle and replayed the previous screen on wake. It worked in the emulator, which does not model the standby, and failed on the hardware: a key press during the screensaver brought the screensaver straight back. The proof of concept only learned about activity through a pending read, replayed raw captured bytes to restore the screen, and let an interval write to the socket while a page owned it. Any of those explains the symptom; all three go away with the design below.

## Goals

- After a configurable idle delay, default 180 s, every connection shows an animated attract screen with an explicit invitation to press a key. The animation also keeps the terminal out of its own standby.
- Any key during the attract screen returns to the welcome page. The page the visitor left is abandoned.
- While a page is in use, the terminal never blanks: a keep-alive byte the terminal ignores goes out at a configurable interval, default 30 s.
- The behaviour is testable with the existing stub Minitel and without hardware, apart from the choice of the keep-alive byte.

## Non-goals

- Restoring the page the visitor left. The welcome page is the only wake target.
- Attract mode content beyond one animated screen. The screen is designed once; a slideshow of the pages is a later idea.
- Changes to the ESP32 firmware or the emulator library.

## Design

### 1. Activity and cancellation in the Minitel class

The class gains three things, all small:

- **An activity stamp on every message.** The constructor registers a permanent `message` listener on the socket that records `Date.now()` in `lastActivity`. It is independent of the per-read `onmessage` handler that `#read` installs, so activity is counted whether or not a page is reading.
- **A cancellable read.** `#read` keeps the resolve and reject of its pending promise in a private field. `cancelRead(error)` rejects the pending read with the given error and clears the field; when nothing is pending it does nothing. `#read` no longer swallows errors: its `catch` only logs socket errors and rethrows everything, so `key()` and `input()` propagate the rejection to the page.
- **`IdleError`**, exported from `minitel.js`, is the error the watchdog uses. Pages never catch it; the welcome loop does.

### 2. Idle timer and keep-alive, in `slice/attract.js`

`startIdle(m, { idleMs, keepaliveMs, keepalive = "\x00", onIdle })` returns `{ stop() }`. It arms a timer for `idleMs`; on expiry it compares `Date.now()` with `m.lastActivity` and either calls `onIdle()` or re-arms itself for the remaining time, so activity anywhere resets the countdown without the timer having to observe messages. When `keepaliveMs` is above zero it also sends `keepalive` through `m.send` at that interval, which goes through the class's write path and therefore never lands inside a sequence. `stop()` clears both timers. Real timers; tests use short delays as the photobooth tests do. Lean choice (2026-09-28): no injected clock, no separate module.

### 3. The attract screen, `slice/attract.js`

`renderAttract(step)` builds a `Screen` from the model: a mosaic smiley drawn with `drawBitmap`, "3615 SLICE" under it and "press any key" in the inverse-key style of the bars, placed by `step` on a short path across the screen so nothing stays put. A frame is a clear plus about 200 bytes, under half a second at 4800 baud.

`runAttract(m, { frameMs = 5000 })` draws frame 0, then loops: wait for a key or `frameMs`, redraw the next frame on timeout, return on a key. The wait is the same race as the photobooth's QR page: a key read against a timer, cleared when the other wins; a key arriving during a redraw is dropped, as on that page. The wake key is consumed here.

### 4. The welcome loop, in `index.js`

The loop body goes inside a `try`. `catch` of an `IdleError` stops the idle timer, runs the attract screen, starts a fresh idle timer and redraws the welcome page; any other error still propagates to the connection handler. The idle timer is started when the page handler begins and stopped when the socket closes. Lean choice (2026-09-28): the welcome page stays in `index.js`; the wake path is verified with a websocket probe against a running server and on the hardware, not by a unit test.

### 5. Cleanup on cancellation

Cancellation surfaces as a rejection from `m.key()` or `m.input()` inside a page. Pages that hold timers move their cleanup into `finally`:

- `slice/photobooth.js`: the notification erase timer.
- `slice/venables.js`: the marquee interval, which today is stopped after the key read returns.

The calendar and omelette pages hold no timers. The photobooth's in-flight capture is not interrupted: cancellation only lands while a page waits for a key, and the capture path awaits the camera, not the keyboard.

### 6. Configuration

Two keys in `.env`, read by `config.js`:

| key | default | meaning |
| --- | --- | --- |
| `IDLE_SECONDS` | `180` | idle time before the attract screen; must stay below the terminal's own standby, four to five minutes on a Minitel 1B |
| `KEEPALIVE_SECONDS` | `30` | interval of the ignored byte while a page is in use; `0` disables it |

`.env.example` and the README's configuration table gain both rows, and the README explains the standby and the attract mode in two sentences.

### 7. The keep-alive byte, hardware check

NUL (`0x00`) is the candidate: the videotex standard treats it as a fill character with no effect on the display. Whether the terminal counts it as activity for its standby is the one thing only hardware can answer. The check, run when the gallery is quiet: set `IDLE_SECONDS` very high, leave the welcome page untouched for six minutes with the keep-alive on, observe that the screen stays on; then with `KEEPALIVE_SECONDS=0`, observe it blank. If NUL does not reset the standby, the fallback is to redraw the status row's menu hint, which is idempotent and already part of the pages. The default byte stays configurable in code, not in `.env`.

## Testing

- Minitel class: `cancelRead` rejects a pending `key()` with the given error, and a later `key()` works; `cancelRead` with nothing pending is a no-op; the activity stamp updates on a message even when nothing is reading; `input()` propagates the rejection.
- Idle timer, with short real delays: fires after `idleMs` of silence, not before; activity in between delays it; keep-alive sends the byte at the interval; `stop()` cancels both.
- Attract: frames move between calls; `runAttract` returns on a key without sending another frame; it sends a new frame on each timeout; the wake key is not left in the buffer.
- Welcome: a websocket probe against a server started with `IDLE_SECONDS=3` sees the attract frames after the delay and the welcome page after a key.
- Photobooth and Venables: cancellation while waiting for a key clears their timers (no pending timer keeps the process alive; the tests already fail-fast on hangs).
- Config: defaults and parsing, including `KEEPALIVE_SECONDS=0`.

## Files touched

```
minitel.js                    lastActivity, cancellable #read, cancelRead, IdleError
slice/attract.js              new: startIdle, renderAttract, runAttract
index.js                      idle timer per connection, catch in the welcome loop
slice/photobooth.js           finally for the erase timer
slice/venables.js             finally for the marquee
config.js                     IDLE_SECONDS, KEEPALIVE_SECONDS
.env.example, README.md       the two keys, a note on the standby
test/minitel-read.test.js     new
test/attract.test.js          new
test/photobooth.test.js       cancellation case
test/config.test.js           the two keys
```
