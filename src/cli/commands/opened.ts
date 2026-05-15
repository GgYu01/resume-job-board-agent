import { runLegacyHarness } from "../legacy-harness.js";

export const commandName = "opened";
export function run(args: string[] = []): number {
  return runLegacyHarness(commandName, args);
}
