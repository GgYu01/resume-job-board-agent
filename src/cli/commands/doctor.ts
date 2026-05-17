import { makeCommandResult, type CommandResult } from "../command-result.js";

export const commandName = "doctor";

export function run(args: string[] = []): CommandResult {
  if (args.includes("--dry-run")) {
    return makeCommandResult({
      category: "success",
      message: "doctor dry-run",
      payload: { command: commandName, dryRun: true },
    });
  }

  return makeCommandResult({
    category: "success",
    message: "doctor remains served by legacy runtime until live use-case migration",
    payload: { command: commandName, legacy: true },
  });
}
