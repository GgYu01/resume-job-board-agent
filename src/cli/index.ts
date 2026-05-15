import { runLegacyHarness } from "./legacy-harness.js";

export function main(argv = process.argv.slice(2)): number {
  const [command = "help", ...args] = argv;
  return runLegacyHarness(command, args);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
