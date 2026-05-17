import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..", "..");
const legacyRuntime = path.join(root, "src", "cli", "runtime-legacy.mjs");

export function runLegacyHarness(command: string, args: string[] = []): number {
  const result = spawnSync(process.execPath, [legacyRuntime, command, ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (typeof result.status === "number") return result.status;
  if (result.error) {
    console.error(result.error.message);
  }
  return 1;
}
