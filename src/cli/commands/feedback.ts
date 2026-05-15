import { runLegacyHarness } from "../legacy-harness.js";

export const commandName = "feedback";
export function run(args: string[] = []): number {
  return runLegacyHarness(commandName, args);
}
