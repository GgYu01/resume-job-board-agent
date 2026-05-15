import { runLegacyHarness } from "../legacy-harness.js";

export const commandName = "launch-hint";
export function run(args: string[] = []): number {
  return runLegacyHarness(commandName, args);
}
