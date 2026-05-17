import assert from "node:assert/strict";
import test from "node:test";

import {
  exitCodeForCategory,
  makeCommandResult,
} from "../../dist/cli/command-result.js";

test("command result maps stable categories to stable exit codes", () => {
  assert.equal(exitCodeForCategory("success"), 0);
  assert.equal(exitCodeForCategory("internal_error"), 1);
  assert.equal(exitCodeForCategory("config_error"), 2);
  assert.equal(exitCodeForCategory("data_error"), 2);
  assert.equal(exitCodeForCategory("auth_required"), 3);
  assert.equal(exitCodeForCategory("access_limited"), 3);
  assert.equal(exitCodeForCategory("browser_unavailable"), 4);
  assert.equal(exitCodeForCategory("external_action_blocked"), 5);
});

test("makeCommandResult creates deterministic JSON payloads", () => {
  const result = makeCommandResult({
    category: "auth_required",
    message: "BOSS login is required.",
    payload: { site: "boss" },
    artifacts: { auth: ".tmp/job_board_harness/auth_status.json" },
    nextAction: "Open login page and retry auth.",
  });

  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 3);
  assert.equal(result.category, "auth_required");
  assert.deepEqual(Object.keys(result).sort(), [
    "artifacts",
    "category",
    "exitCode",
    "message",
    "nextAction",
    "ok",
    "payload",
  ]);
});
