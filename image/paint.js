export function paint(screen, row, col, cells) {
  cells.forEach((line, cy) => {
    line.forEach((cell, cx) => {
      const value = "char" in cell
        ? { char: cell.char, fg: cell.fg, bg: cell.bg, mosaic: false }
        : { mosaic: true, char: cell.bits, fg: cell.fg, bg: cell.bg };
      screen.set(row + cy, col + cx, value);
    });
  });
}
