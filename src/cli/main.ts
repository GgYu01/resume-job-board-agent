import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeCommandResult, type CommandResult } from "./command-result.js";
import { parseCliArgs } from "./parser.js";
import { run as runDoctor } from "./commands/doctor.js";

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}

type CommandHandler = (args: string[]) => Promise<CommandResult> | CommandResult;

const commands: Record<string, CommandHandler> = {
  doctor: runDoctor,
};

const legacyCommands = new Set([
  "run",
  "profile",
  "launch-hint",
  "start-browser",
  "diagnose",
  "doctor",
  "auth",
  "resume",
  "collect",
  "rank",
  "extract-details",
  "agent-review",
  "select",
  "summarize-contacts",
  "feedback",
  "open",
  "open-batches",
  "followup-recheck",
  "test-fixture",
  "opened",
  "cleanup-pages",
  "workflow",
  "help",
  "--help",
  "-h",
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");
const legacyRuntime = path.join(root, "src", "cli", "runtime-legacy.mjs");

const defaultIo: CliIo = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
};

export async function main(argv = process.argv.slice(2), io: CliIo = defaultIo): Promise<number> {
  const parsed = parseCliArgs(argv);
  const handler = commands[parsed.command];
  if (!(parsed.command === "doctor" && parsed.args.includes("--dry-run")) && legacyCommands.has(parsed.command)) {
    const result = spawnSync(process.execPath, [legacyRuntime, parsed.command, ...parsed.args], {
      cwd: root,
      stdio: "inherit",
    });
    if (typeof result.status === "number") return result.status;
    if (result.error) io.stderr(result.error.message);
    return 1;
  }

  if (!handler) {
    const result = makeCommandResult({
      category: "data_error",
      message: `Unknown command: ${parsed.command}`,
      payload: { command: parsed.command },
      nextAction: "Run help.",
    });
    io.stderr(JSON.stringify(result, null, 2));
    return result.exitCode;
  }

  const result = await handler(parsed.args);
  io.stdout(JSON.stringify(result, null, 2));
  return result.exitCode;
}
