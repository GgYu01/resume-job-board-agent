import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

const MAIN_FLOW_FILES = [
  "src/cli/runtime.mjs",
  "src/config/browser-config.mjs",
  "tools/job_board_harness.mjs",
];

const FORBIDDEN_IMPLICIT_TOOLS = [
  "page-agent",
  "chrome-devtools",
  "playwright-mcp",
  "browser-use",
  "tool_search",
  "mcp__",
];

test("job-board live flow has no implicit MCP or managed-browser fallback", () => {
  for (const relative of MAIN_FLOW_FILES) {
    const absolute = path.join(ROOT, relative);
    const text = fs.readFileSync(absolute, "utf8");
    for (const token of FORBIDDEN_IMPLICIT_TOOLS) {
      assert.doesNotMatch(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `${relative} must not reference ${token}`);
    }
  }
});
