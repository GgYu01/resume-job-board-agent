import { runLegacyHarness } from "../legacy-harness.js";

export const commandName = "cleanup-pages";
export function run(args: string[] = []): number {
  return runLegacyHarness(commandName, args);
}
