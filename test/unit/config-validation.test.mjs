import assert from "node:assert/strict";
import test from "node:test";

import { validateRoleProfile } from "../../src/config/load-config.mjs";

test("typed role profile schema validates current durable profiles", async () => {
  const { validateRoleProfileConfig } = await import("../../dist/config/profile-schema.js");
  const profile = {
    id: "ai-agent-dev",
    label: "AI Agent 工程化",
    version: 1,
    must_have: [{ term: "AI Agent", weight: 18 }],
    should_have: [{ term: "LLM", weight: 14 }],
    nice_to_have: [],
    negative: [{ term: "销售", weight: -30 }],
    hard_filters: {
      min_salary: null,
      cities: [],
      reject_internship: true,
      reject_part_time: true,
    },
    ranking_policy: { use_default_terms: false },
    review_policy: {
      codex_review_top_n: 40,
      codex_review_borderline_n: 20,
      require_evidence: true,
      allow_uncertain: false,
    },
    batch_policy: {
      max_per_batch: 15,
      batch_cooldown_ms: 45000,
      jitter_ms: 10000,
      stop_on_access_limited: true,
    },
  };

  const result = validateRoleProfileConfig(profile);
  assert.equal(result.ok, true);
});

test("validateRoleProfile rejects invalid batch, review, and hard-filter shapes", () => {
  const validation = validateRoleProfile({
    id: "bad-profile",
    label: "Bad Profile",
    must_have: [{ term: "Linux", weight: 10 }],
    hard_filters: {
      cities: "深圳",
      reject_internship: "yes",
    },
    review_policy: {
      codex_review_top_n: 0,
      codex_review_borderline_n: -1,
      require_evidence: "true",
      allow_uncertain: "false",
    },
    batch_policy: {
      max_per_batch: 30,
      batch_cooldown_ms: -1,
      jitter_ms: "slow",
      stop_on_access_limited: "yes",
    },
  });

  assert.deepEqual(validation.errors.sort(), [
    "batch_policy.batch_cooldown_ms must be a non-negative number",
    "batch_policy.jitter_ms must be a non-negative number",
    "batch_policy.max_per_batch must be an integer between 1 and 20",
    "batch_policy.stop_on_access_limited must be boolean",
    "hard_filters.cities must be a list",
    "hard_filters.reject_internship must be boolean",
    "review_policy.allow_uncertain must be boolean",
    "review_policy.codex_review_borderline_n must be a positive integer",
    "review_policy.codex_review_top_n must be a positive integer",
    "review_policy.require_evidence must be boolean",
  ].sort());
});

test("validateRoleProfile accepts the durable profile policy shape", () => {
  const validation = validateRoleProfile({
    id: "good-profile",
    label: "Good Profile",
    must_have: [{ term: "AI Agent", weight: 18 }],
    should_have: [],
    nice_to_have: [],
    negative: [{ term: "销售", weight: -30 }],
    hard_filters: {
      min_salary: null,
      cities: [],
      reject_internship: true,
      reject_part_time: true,
    },
    review_policy: {
      codex_review_top_n: 40,
      codex_review_borderline_n: 20,
      require_evidence: true,
      allow_uncertain: false,
    },
    batch_policy: {
      max_per_batch: 15,
      batch_cooldown_ms: 45000,
      jitter_ms: 10000,
      stop_on_access_limited: true,
    },
  });

  assert.deepEqual(validation.errors, []);
});
