import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");

test("productized run plan includes detail extraction and second ranking pass", () => {
  const runId = "contract_run_pipeline_plan";
  const runDir = path.join(STATE_DIR, "runs", runId);
  fs.rmSync(runDir, { recursive: true, force: true });

  const out = execFileSync(process.execPath, [
    HARNESS,
    "run",
    "--profile",
    "ai-agent-dev",
    "--run-id",
    runId,
    "--dry-run",
  ], { cwd: ROOT, encoding: "utf8" });

  const parsed = JSON.parse(out);
  const input = JSON.parse(fs.readFileSync(path.join(runDir, "input.json"), "utf8"));
  const expected = [
    "auth",
    "collect",
    "rank",
    "extract-details",
    "rank-details",
    "agent-review",
    "select",
    "open-batches",
  ];

  assert.deepEqual(parsed.plan, expected);
  assert.deepEqual(input.plan, expected);
});
