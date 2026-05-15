import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { suggestProfilePatch } from "../../src/config/profile-patch.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");

test("suggestProfilePatch converts feedback into explicit profile patch operations", () => {
  const patch = suggestProfilePatch({
    feedback: {
      false_positive: ["sales"],
      false_negative: ["workflow"],
    },
    candidatesById: {
      sales: {
        title: "AI 销售顾问",
        explain: { negative: [{ term: "销售" }], matched: [{ term: "AI" }] },
      },
      workflow: {
        title: "Workflow Automation Engineer",
        explain: { matched: [{ term: "workflow automation" }] },
      },
    },
  });

  assert(patch.operations.some((op) => op.type === "add_negative_term" && op.term === "销售"));
  assert(patch.operations.some((op) => op.type === "add_positive_term" && op.term === "workflow automation"));
});

test("profile apply-patch and rollback preserve profile history", () => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const profileFile = path.join(STATE_DIR, "test_patch_profile.yaml");
  const patchFile = path.join(STATE_DIR, "test_profile_patch.json");
  fs.writeFileSync(profileFile, [
    "id: test-patch-profile",
    "label: Test Patch Profile",
    "version: 1",
    "must_have:",
    "  - term: \"AI Agent\"",
    "    weight: 18",
    "should_have: []",
    "nice_to_have: []",
    "negative: []",
    "hard_filters:",
    "  cities: []",
    "  reject_internship: true",
    "  reject_part_time: true",
    "review_policy:",
    "  codex_review_top_n: 40",
    "  codex_review_borderline_n: 20",
    "  require_evidence: true",
    "  allow_uncertain: false",
    "batch_policy:",
    "  max_per_batch: 15",
    "  batch_cooldown_ms: 45000",
    "  jitter_ms: 10000",
    "  stop_on_access_limited: true",
    "",
  ].join("\n"), "utf8");
  fs.writeFileSync(patchFile, `${JSON.stringify({
    operations: [
      { type: "add_positive_term", term: "workflow automation", weight: 8, reason: "false negative" },
      { type: "add_negative_term", term: "销售", weight: -30, reason: "false positive" },
    ],
  }, null, 2)}\n`, "utf8");

  const applied = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "profile",
    "apply-patch",
    "--profile",
    profileFile,
    "--patch",
    patchFile,
    "--reason",
    "unit patch",
  ], { cwd: ROOT, encoding: "utf8" }));
  assert(fs.existsSync(applied.history));
  let text = fs.readFileSync(profileFile, "utf8");
  assert.match(text, /workflow automation/);
  assert.match(text, /销售/);

  const rolledBack = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "profile",
    "rollback",
    "--profile",
    profileFile,
    "--history",
    applied.history,
  ], { cwd: ROOT, encoding: "utf8" }));
  assert.equal(rolledBack.output, profileFile);
  text = fs.readFileSync(profileFile, "utf8");
  assert.doesNotMatch(text, /workflow automation/);
});
