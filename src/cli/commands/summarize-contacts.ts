import { runLegacyHarness } from "../legacy-harness.js";

export const commandName = "summarize-contacts";
export function run(args: string[] = []): number {
  return runLegacyHarness(commandName, args);
}
