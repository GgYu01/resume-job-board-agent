import { runLegacyHarness } from "../legacy-harness.js";

export const commandName = "agent-review";
export function run(args: string[] = []): number {
  return runLegacyHarness(commandName, args);
}
