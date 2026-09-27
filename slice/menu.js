export function programsFor(programs, { terminal = false } = {}) {
  return programs.filter((program) => !program.terminalOnly || terminal);
}
