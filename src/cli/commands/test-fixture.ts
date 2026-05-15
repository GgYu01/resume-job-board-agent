import { runLegacyHarness } from "../legacy-harness.js";

export const commandName = "test-fixture";
export function run(args: string[] = []): number {
  return runLegacyHarness(commandName, args);
}
