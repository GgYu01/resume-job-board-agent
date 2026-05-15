import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { scoreRecord } from "../../src/rank/keyword-ranker.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");

test("profile ranking uses profile terms instead of built-in default positives", () => {
  const profile = {
    id: "profile-only",
    label: "Profile Only",
    must_have: [{ term: "Kubernetes", weight: 12 }],
    should_have: [],
    nice_to_have: [],
    negative: [],
    hard_filters: {},
  };

  const unrelatedDefaultHit = scoreRecord({
    title: "AI Agent Engineer",
    cardText: "LLM RAG MCP",
  }, { profile });
  assert.equal(unrelatedDefaultHit.score, 0);
  assert.equal(unrelatedDefaultHit.explain.matched.length, 0);

  const profileHit = scoreRecord({
    title: "Kubernetes Platform Engineer",
  }, { profile });
  assert(profileHit.score > 0);
  assert(profileHit.explain.matched.some((item) => item.term === "Kubernetes"));
});

test("hard filters reject below-min salary and above-max experience", () => {
  const profile = {
    id: "hard-filter",
    label: "Hard Filter",
    must_have: [{ term: "Kubernetes", weight: 12 }],
    should_have: [],
    nice_to_have: [],
    negative: [],
    hard_filters: {
      min_salary: 30,
      max_experience_years: 5,
      cities: [],
      reject_internship: true,
      reject_part_time: true,
    },
  };

  const scored = scoreRecord({
    title: "Kubernetes Platform Engineer",
    salary: "10-15K",
    experience: "10 years",
  }, { profile });

  assert(scored.hardRejected.some((reason) => reason.startsWith("salary-below-min")));
  assert(scored.hardRejected.some((reason) => reason.startsWith("experience-above-max")));
  assert(scored.score < -100);
});

test("run --fixture writes the pipeline artifacts under the requested run directory", () => {
  const runId = "unit_remaining_run_artifacts";
  const runDir = path.join(STATE_DIR, "runs", runId);
  fs.rmSync(runDir, { recursive: true, force: true });

  const out = execFileSync(process.execPath, [
    HARNESS,
    "run",
    "--profile",
    "ai-agent-dev",
    "--fixture",
    "boss-search-normal",
    "--run-id",
    runId,
    "--dry-run",
  ], { cwd: ROOT, encoding: "utf8" });

  const parsed = JSON.parse(out);
  assert.equal(parsed.run_id, runId);
  assert.equal(parsed.run_dir, runDir);
  for (const name of ["input.json", "candidates.json", "ranked.json", "agent_review.json", "selection.json", "open_queue.json", "summary.md"]) {
    assert(fs.existsSync(path.join(runDir, name)), `${name} should exist in run dir`);
  }
});

test("target TypeScript CLI wrapper structure exists for future harness migration", () => {
  assert(fs.existsSync(path.join(ROOT, "tsconfig.json")));
  assert(fs.existsSync(path.join(ROOT, "src", "cli", "index.ts")));
  assert(fs.existsSync(path.join(ROOT, "src", "cli", "runtime.mjs")));
  for (const command of ["run", "rank", "agent-review", "open-batches", "feedback", "doctor"]) {
    assert(fs.existsSync(path.join(ROOT, "src", "cli", "commands", `${command}.ts`)), `${command}.ts missing`);
  }
});

test("tools harness is a small compatibility entrypoint into src/cli", () => {
  const entry = fs.readFileSync(path.join(ROOT, "tools", "job_board_harness.mjs"), "utf8");
  assert(entry.includes("../src/cli/runtime.mjs"));
  assert(entry.split(/\r?\n/).length <= 80);
});
