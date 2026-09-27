# Image to videotex converter

Date: 2026-09-27. Branch: `slice`.

## Goal

Turn a raster image into greyscale Minitel mosaic cells that render well on a
real Minitel and in the bundled emulator, with a handful of selectable looks.
The converter feeds a future webcam photobooth page and replaces the proof of
concept in `bin/img2vdt.js`. A web playground lets us tune settings by eye
without a websocket session.

Out of scope: the photobooth page itself, colour output, text-mode glyph
matching, disjoint mosaics, byte-budget optimisation, hardware calibration.
These are listed under follow-ups.

## Constraints and facts the design relies on

- A Minitel cell is 8 by 10 screen pixels. In mosaic mode it holds a 2 by 3
  block of subpixels with rows 3, 4 and 3 pixels tall, so a subpixel is 1.2
  times wider than tall. A grid of `cols` by `rows` cells covers `8*cols` by
  `10*rows` screen pixels, 4:3 for the full 40 by 24 screen.
- A cell has one foreground and one background colour, each one of 8 indices.
  On a greyscale Minitel the indices map to these lightness levels, taken from
  the emulator table which follows the STUM specification:

  | index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  |-------|---|---|---|---|---|---|---|---|
  | level | 0 | .5 | .7 | .9 | .4 | .6 | .8 | 1 |

  Seven levels sit between 40 and 100 percent. There is nothing between black
  and 40. The table lives in one constant so it can be corrected after
  measuring the real tube.
- Mosaic bit `i` corresponds to subpixel `(dx, dy)` with `i = dy*2 + dx`.
  Encoding to videotex is already handled by `screen.js` and `mosaic.js`.
- Background colour applies immediately in mosaic mode, so no space trick is
  needed.
- The link runs at 4800 baud, about 480 bytes per second. A full screen costs
  2000 to 3500 bytes depending on attribute churn, so 4 to 8 seconds.

## Findings from the probe

A throwaway script compared strategies on portraits. What carried over:

- Exact per-cell fitting over all 64 patterns and every foreground and
  background pair beats averaging then quantising, and is cheap enough to brute
  force: about 50 ms for a full screen in node.
- Adding a penalty on the cell's mean tone error to the per-subpixel squared
  error is the single most useful knob. Without it the fit chases shape and
  drifts in brightness.
- Error diffusion at cell granularity gives a photographic look. Ordered
  dithering gives a halftone look. No dithering gives a poster look. Restricted
  palettes give newsprint and stencil looks. Each is worth keeping as a preset.
- Percentile auto-levels on the input matters more than sharpening, which adds
  noise at this resolution.
- Removing black from the palette without remapping the input breaks error
  diffusion. Any future black-floor feature must be a tone map in the prepare
  stage, not a palette restriction.

## Architecture

Three pure stages and a thin wrapper, in a new `image/` directory.

```
image/levels.js    LEVELS constant, palette helpers
image/prepare.js   image bytes -> grey field           (sharp, node only)
image/quantise.js  grey field  -> cells                (pure JS)
image/paint.js     cells       -> Screen               (pure JS)
image/presets.js   named looks -> option bundles
image/index.js     convert(source, options) -> { cells, bytes, field }
bin/img2vdt.js     CLI over image/index.js (rewritten)
emulator/playground.html   web playground
server.js          POST /api/vdt endpoint and static playground
```

### prepare(source, cols, rows, options) -> field

`source` is a file path or Buffer, anything sharp can decode.

1. Flatten alpha onto black, convert to greyscale.
2. Crop to the cell-grid aspect ratio, `8*cols : 10*rows`, using sharp's
   `cover` fit. `options.position` selects the crop anchor, default `centre`.
   This is the only place aspect is handled; for the full screen it is 4:3.
3. Resample to `2*cols` by `3*rows` with `fill` fit and lanczos3. The
   non-uniform scale factors bake in the 1.2 subpixel aspect.
4. Convert to `Float32Array` of lightness in `[0, 1]`.
5. `options.levels` (default `true`): stretch the 1st to 99th percentile to
   `[0, 1]` and clamp.
6. `options.gamma` (default `1`): apply `v ** gamma`.

Returns `{ width: 2*cols, height: 3*rows, data }`.

### quantise(field, options) -> cells

`cells[cy][cx]` is `{ bits, fg, bg }`. Options:

- `method`: `flat`, `diffuse` or `bayer`. Default `diffuse`.
- `palette`: allowed colour indices, default all eight.
- `toneWeight`: weight of the mean-tone term, default `2`.
- `serpentine`: alternate row direction in `diffuse`, default `true`.

`fitCell(target6, options)` searches every pattern `0..63` and every `(fg, bg)`
pair from the palette, skipping `fg != bg` when the pattern is all background
or all foreground, and returns the lowest cost. Cost is the sum of squared
subpixel errors plus `toneWeight * 6 * (meanRendered - meanTarget)^2`. Ties
resolve to the first candidate in search order so output is deterministic.

- `flat`: fit each cell against the field as is.
- `diffuse`: Floyd-Steinberg with the neighbourhood expressed in cell units.
  Cells are decided atomically in scan order, serpentine by row. The residual
  of subpixel `(dx, dy)` is added to subpixel `(dx, dy)` of the cells to the
  right, below-left, below and below-right with weights 7, 3, 5, 1 over 16.
  Errors that would leave the grid are dropped.
- `bayer`: for each subpixel, find the two nearest allowed levels that bracket
  the value and pick the upper one when the normalised position exceeds the 8
  by 8 Bayer threshold at that subpixel. Then run `flat` on the result.

### paint(screen, row, col, cells)

Writes each cell with `screen.set(row + cy, col + cx, { mosaic: true, char:
bits, fg, bg })`. Out-of-range cells are clipped by `Screen.set`, matching the
behaviour of `drawBitmap`.

### presets.js

A table of option bundles for prepare and quantise. Overrides merge on top.

| preset    | method  | palette      | toneWeight | notes                       |
|-----------|---------|--------------|------------|-----------------------------|
| photo     | diffuse | all          | 2          | default                     |
| poster    | flat    | all          | 0          | clean, banded               |
| halftone  | bayer   | all          | 0          | screen-print texture        |
| newsprint | diffuse | 0, 7         | 2          | one-bit halftone            |
| stencil   | flat    | 0, 4, 7      | 0          | three tones, cheapest bytes |

An unknown preset name throws.

### convert(source, { cols, rows, row, col, preset, ...overrides })

Runs prepare, quantise and paint into a fresh `Screen(24, 40)` at `row`, `col`
(default 1, 1), then encodes with `screen.js`. Returns `{ cells, field, bytes }`
where `bytes` is a `Buffer` of the videotex stream for the painted region.
The photobooth will call `prepare`, `quantise` and `paint` directly so it can
compose the image with text on its own screen.

### CLI: bin/img2vdt.js

Rewritten over `convert` using commander, which is already a dependency.

```
node bin/img2vdt.js <image> [--cols 40] [--rows 24] [--row 1] [--col 1]
                    [--preset photo] [--method m] [--palette 0,4,7]
                    [--tone 2] [--no-levels] [--gamma 1] [--out file.vdt]
```

Writes the stream to `--out` or stdout. Prints byte count and seconds at 4800
baud to stderr.

### HTTP endpoint: POST /api/vdt

Added in `server.js` next to the static mount. Body is the raw image, limited
to 10 MB via `express.raw`. Query parameters mirror the CLI flags. Responds
with `application/octet-stream` containing the stream, plus an `X-Vdt-Bytes`
header. Invalid options return 400 with the error message; decode failures
also return 400. The endpoint exists for the playground and costs nothing to
leave enabled.

### Playground: emulator/playground.html

A page served by the existing static mount at `/playground.html`.

- One `x-minitel` container with only the screen canvas, greyscale, and
  `data-socket="none"`. The emulator library gets a two-line change so that
  value disables the websocket instead of defaulting to the page host.
- Image input by file picker, drag and drop, and clipboard paste.
- Controls for preset, method, palette, tone weight, levels, gamma, crop
  position, cols, rows, row and col. Changing any control re-posts the current
  image to `/api/vdt` and shows the result.
- Two ways to show the result: instant via `directSend`, or "replay at 4800"
  which clears the screen and queues the bytes through `send` so the reveal
  feels like the real terminal. The page shows byte count and seconds.
- The image and settings stay in memory only. No websocket, no server state.

## Error handling

- `prepare` lets sharp errors propagate; callers map them to exit code 1 in
  the CLI and 400 in the endpoint.
- `cols` and `rows` must be positive integers; `palette` entries must be
  integers 0 to 7 with at least one entry; `toneWeight` and `gamma` must be
  finite and non-negative. Violations throw before any work starts.
- `paint` clips silently, consistent with the rest of the Screen API.

## Testing

`node --test`, following the existing tests in `test/`.

- `quantise.test.js`: a uniform cell maps to pattern 0 with the nearest level;
  a known six-value block returns the expected pattern and pair; a restricted
  palette never yields other indices; complementary pattern and swapped pair
  give equal cost; `diffuse` on a constant 0.2 field reproduces a mean within
  0.02 across a 20 by 8 grid while `flat` does not; `bayer` leaves on-palette
  values unchanged; results are deterministic across two runs.
- `prepare.test.js`: a generated 4:3 gradient PNG comes back at `2*cols` by
  `3*rows`, monotonic left to right, stretched to `[0, 1]`; a 16:9 image is
  centre-cropped; alpha flattens to black.
- `paint.test.js`: cells land at the requested row and column with mosaic set;
  encoding the screen yields only glyphs in `0x20-0x3f` and `0x60-0x7f`.
- `presets.test.js`: every preset converts a fixture; unknown name throws.
- Endpoint smoke test with a tiny PNG through `startServer` on an ephemeral
  port, checking status, content type and the byte header.

Visual checks happen in the playground, not in tests.

## Amendment 2026-09-27: browser conversion in the playground

The playground now converts in the browser by default. `image/prepare.js` was split: `image/field.js` holds the pure core (Rec. 601 luminance, percentile levels, gamma, cover-crop geometry) and both the sharp front end and a canvas front end, `image/prepare-browser.js`, call it. `server.js` serves `image/`, `screen.js` and `mosaic.js` under `/lib` for the page. A "server" checkbox routes the same options through `POST /api/vdt` for comparison. Measured on portraits, the two paths differ by about 1 percent per subpixel before quantising and are visually equivalent; diffusion presets differ cell for cell because the dither pattern is chaotic. The endpoint and CLI keep the sharp path for the photobooth, but their colour handling changed with this split: node no longer uses libvips' linear-light greyscale and instead applies the shared gamma-space Rec. 601 luminance, so colour input renders differently from before (pure red goes from 0.50 to 0.30 lightness; greyscale input is unchanged). The playground offers only the five geometric crop anchors.

## Follow-ups, not in this spec

- Grey ramp calibration screen to measure the real tube's levels.
- Black floor tone map and alpha-aware matte handling.
- Row-wise attribute solver to cut bytes when reveal time matters.
- Disjoint mosaics and text-mode glyph matching as extra looks.
- Regenerating the existing `screens/*.vdt` with the new converter.
- The photobooth page and webcam capture.
