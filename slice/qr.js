import QRCode from "qrcode";

export function qrBitmap(text, { scale = 2, margin = 2 } = {}) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const side = (modules.size + 2 * margin) * scale;
  const bitmap = [];
  for (let y = 0; y < side; y++) {
    const line = new Uint8Array(side);
    const my = Math.floor(y / scale) - margin;
    for (let x = 0; x < side; x++) {
      const mx = Math.floor(x / scale) - margin;
      const inside =
        my >= 0 && my < modules.size && mx >= 0 && mx < modules.size;
      line[x] = inside && modules.get(my, mx) ? 1 : 0;
    }
    bitmap.push(line);
  }
  return bitmap;
}
