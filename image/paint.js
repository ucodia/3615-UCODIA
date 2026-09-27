export function paint(screen, row, col, cells) {
  cells.forEach((line, cy) => {
    line.forEach(({ bits, fg, bg }, cx) => {
      screen.set(row + cy, col + cx, { mosaic: true, char: bits, fg, bg });
    });
  });
}
