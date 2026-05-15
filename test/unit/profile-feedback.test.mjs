import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { computeRegressionMetrics } from "../../src/metrics/regression.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");

test("profile init draft and freeze preserve a config history entry", () => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const draft = path.join(STATE_DIR, "test_profile_draft.yaml");
  const frozen = path.join(STATE_DIR, "test_frozen_profile.yaml");
  fs.rmSync(draft, { force: true });
  fs.rmSync(frozen, { force: true });

  const init = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "profile",
    "init",
    "--id",
    "test-freeze-profile",
    "--need",
    "AI Agent / RAG",
    "--draft",
    "--out",
    draft,
    "--force",
  ], { cwd: ROOT, encoding: "utf8" }));
  assert.equal(init.draft, true);
  assert.equal(init.output, draft);
  assert(fs.existsSync(draft));

  const freeze = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "profile",
    "freeze",
    "--input",
    draft,
    "--out",
    frozen,
    "--reason",
    "unit test freeze",
    "--force",
  ], { cwd: ROOT, encoding: "utf8" }));
  assert.equal(freeze.output, frozen);
  assert.equal(freeze.reason, "unit test freeze");
  assert(fs.existsSync(freeze.history));
});

test("computeRegressionMetrics records precision and duplicate/access counts", () => {
  const metrics = computeRegressionMetrics({
    selected: [{ id: "a" }, { id: "b" }],
    opened: [{ id: "a" }, { id: "a" }, { id: "b" }],
    accessLimited: [{ id: "b" }],
    feedback: {
      accepted: ["a"],
      false_positive: ["b"],
      false_negative: ["c"],
      accepted_config_suggestions: ["add:workflow automation"],
    },
  });

  assert.equal(metrics.precision_at_15, 0.5);
  assert.equal(metrics.duplicate_open_count, 1);
  assert.equal(metrics.access_limited_count, 1);
  assert.equal(metrics.false_positive_count, 1);
  assert.equal(metrics.false_negative_count, 1);
  assert.equal(metrics.user_accepted_config_suggestions_count, 1);
});

test("feedback command can write a profile patch suggestion from run artifacts", () => {
  const runDir = path.join(STATE_DIR, "runs", "unit_feedback_patch");
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, "selection.json"), `${JSON.stringify({
    selected: [
      { id: "sales", title: "AI sales consultant", url: "https://jobs.51job.com/shenzhen/155500001.html" },
      { id: "workflow", title: "Workflow Automation Engineer", url: "https://jobs.51job.com/shenzhen/155500002.html" },
    ],
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(runDir, "ranked.json"), `${JSON.stringify({
    ranked: [
      {
        id: "sales",
        title: "AI sales consultant",
        explain: { negative: [{ term: "sales" }], matched: [{ term: "AI" }] },
      },
      {
        id: "workflow",
        title: "Workflow Automation Engineer",
        explain: { matched: [{ term: "workflow automation" }] },
      },
    ],
  }, null, 2)}\n`, "utf8");

  const result = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "feedback",
    "--run",
    "unit_feedback_patch",
    "--false-positive",
    "sales",
    "--false-negative",
    "workflow",
    "--suggest-profile-patch",
  ], { cwd: ROOT, encoding: "utf8" }));

  assert(fs.existsSync(result.profile_patch));
  const patch = JSON.parse(fs.readFileSync(result.profile_patch, "utf8"));
  assert(patch.operations.some((op) => op.type === "add_negative_term" && op.term === "sales"));
  assert(patch.operations.some((op) => op.type === "add_positive_term" && op.term === "workflow automation"));
});
