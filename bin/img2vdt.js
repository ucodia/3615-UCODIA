import sharp from "sharp";

// this script converts an image to a videotex file format (.vdt) for minitel stream

function rgbDistance(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function averageColor(pixels) {
  const sum = pixels.reduce(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
    [0, 0, 0]
  );
  return sum.map((x) => x / pixels.length);
}

function getBestMosaic(pixels) {
  const indices = [...Array(6).keys()];
  let best = { score: Infinity, fg: null, bg: null, charCode: 0x20 };

  for (let i = 1; i < 64; i++) {
    const fgIndices = indices.filter((bit) => (i >> bit) & 1);
    const bgIndices = indices.filter((bit) => !((i >> bit) & 1));
    if (fgIndices.length === 0 || bgIndices.length === 0) continue;

    const fgPixels = fgIndices.map((j) => pixels[j]);
    const bgPixels = bgIndices.map((j) => pixels[j]);
    const fg = averageColor(fgPixels);
    const bg = averageColor(bgPixels);

    let score = 0;
    for (let j = 0; j < 6; j++) {
      const target = pixels[j];
      const ref = (i >> j) & 1 ? fg : bg;
      score += rgbDistance(target, ref);
    }

    if (score < best.score) {
      best = { score, fg, bg, charCode: 0x20 + i };
    }
  }

  return { fg: best.fg, bg: best.bg, charCode: best.charCode };
}

function nearestColorIndex(color) {
  const palette = [
    [0, 0, 0],
    [0, 0, 255],
    [0, 255, 0],
    [0, 255, 255],
    [255, 0, 0],
    [255, 0, 255],
    [255, 255, 0],
    [255, 255, 255],
  ];
  let best = 0,
    minDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = rgbDistance(color, palette[i]);
    if (d < minDist) {
      minDist = d;
      best = i;
    }
  }
  return best;
}

function esc(code) {
  return Buffer.from([0x1b, code]);
}

async function processImage(filename) {
  const width = 80,
    height = 72;
  const data = await sharp(filename)
    .resize(width, height, { fit: "contain" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: pixels, info } = data;
  const mosaicWidth = width / 2;
  const mosaicHeight = height / 3;
  const output = [];

  // Start with control codes found in the good file
  output.push(0x0c); // Form Feed
  output.push(0x0e); // Shift Out

  let lastFg = -1,
    lastBg = -1;

  for (let y = 0; y < mosaicHeight; y++) {
    for (let x = 0; x < mosaicWidth; x++) {
      const px = [];
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const ix = (y * 3 + dy) * width + (x * 2 + dx);
          const offset = ix * 4;
          px.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
        }
      }

      const { fg, bg, charCode } = getBestMosaic(px);
      const fgIndex = nearestColorIndex(fg);
      const bgIndex = nearestColorIndex(bg);

      if (fgIndex !== lastFg) {
        output.push(...esc(0x40 + fgIndex));
        lastFg = fgIndex;
      }

      if (bgIndex !== lastBg) {
        output.push(...esc(0x50 + bgIndex));
        lastBg = bgIndex;
      }

      // Use 0x7f (DEL) for empty spaces instead of regular characters
      // This matches what we see in the good file
      if (charCode === 0x20) {
        output.push(0x7f);
      } else {
        output.push(charCode);
      }
    }
    // No carriage return - the good file doesn't have them
  }

  process.stdout.write(Buffer.from(output));
}

const filename = process.argv[2];
if (!filename) {
  console.error("Usage: node img2vdt.js <image>");
  process.exit(1);
}
processImage(filename);
