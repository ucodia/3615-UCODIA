export function programsFor(programs, { terminal = false } = {}) {
  return programs.filter((program) => program.terminal === undefined || program.terminal === terminal);
}
