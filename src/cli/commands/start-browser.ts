import { runLegacyHarness } from "../legacy-harness.js";

export const commandName = "start-browser";
export function run(args: string[] = []): number {
  return runLegacyHarness(commandName, args);
}
