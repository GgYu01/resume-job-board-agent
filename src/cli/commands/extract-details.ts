import { runLegacyHarness } from "../legacy-harness.js";

export const commandName = "extract-details";
export function run(args: string[] = []): number {
  return runLegacyHarness(commandName, args);
}
