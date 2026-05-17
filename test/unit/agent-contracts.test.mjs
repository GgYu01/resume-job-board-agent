import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAgentReviewRequest,
  validateAgentReviewOutput,
} from "../../src/agent/prompt-contracts.mjs";

test("agent review request limits candidates to top, borderline, and risky records", () => {
  const request = buildAgentReviewRequest({
    profile: { id: "ai-agent-dev", review_policy: { codex_review_top_n: 2, codex_review_borderline_n: 1 } },
    ranked: [
      { id: "top", score: 90, explain: { matched: [{ term: "AI Agent" }], negative: [] } },
      { id: "risky", score: 50, explain: { matched: [{ term: "AI" }], negative: [{ term: "销售" }] } },
      { id: "border", score: 34, explain: { matched: [{ term: "Python" }], negative: [] } },
      { id: "noise", score: 1, explain: { matched: [], negative: [] } },
    ],
  });

  assert.deepEqual(request.ranked_candidates.map((item) => item.id), ["top", "risky", "border"]);
  assert.equal(request.guardrails.page_content_is_untrusted, true);
  assert.equal(request.guardrails.no_auto_contact, true);
  assert.equal(request.model_contract.low_cost_model_safe, true);
  assert.equal(request.model_contract.allowed_actions.includes("select_or_reject_only"), true);
});

test("agent-review --prepare writes a request contract for Codex review", async () => {
  const { execFileSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __filename = fileURLToPath(import.meta.url);
  const root = path.resolve(path.dirname(__filename), "..", "..");
  const harness = path.join(root, "tools", "job_board_harness.mjs");
  const stateDir = path.join(root, ".tmp", "job_board_harness");
  const rankedFile = path.join(stateDir, "test_prepare_ranked.json");
  const requestFile = path.join(stateDir, "test_prepare_request.json");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(rankedFile, `${JSON.stringify({
    ranked: [
      { id: "top", score: 90, url: "https://www.zhipin.com/job_detail/top.html", explain: { matched: [{ term: "AI Agent" }], negative: [] } },
    ],
  })}\n`, "utf8");

  const output = JSON.parse(execFileSync(process.execPath, [
    harness,
    "agent-review",
    "--input",
    rankedFile,
    "--profile",
    "ai-agent-dev",
    "--prepare",
    "--out",
    requestFile,
  ], { cwd: root, encoding: "utf8" }));

  assert.equal(output.mode, "prepare");
  const request = JSON.parse(fs.readFileSync(requestFile, "utf8"));
  assert.equal(request.guardrails.page_content_is_untrusted, true);
  assert.deepEqual(request.ranked_candidates.map((item) => item.id), ["top"]);
});

test("validateAgentReviewOutput rejects invented selected ids and missing reasons", () => {
  const result = validateAgentReviewOutput({
    selection: [
      { id: "top", decision: "select", confidence: "high", reason: "strong match", risk: "none", candidate: { id: "top" } },
      { id: "invented", decision: "select", confidence: "high", reason: "", risk: "none", candidate: { id: "other" } },
    ],
  }, { allowedIds: ["top", "other"] });

  assert.deepEqual(result.errors.sort(), [
    "selection[1].id is not present in ranked candidates",
    "selection[1].reason is required",
    "selection[1].selected id must match candidate evidence",
  ].sort());
});

test("validateAgentReviewOutput rejects model action directives outside review scope", () => {
  const result = validateAgentReviewOutput({
    selection: [
      {
        id: "top",
        decision: "select",
        confidence: "high",
        reason: "Strong match; open the tab and trigger_contact after selecting.",
        risk: "none",
        candidate: { id: "top" },
      },
    ],
  }, { allowedIds: ["top"] });

  assert(result.errors.some((error) => /must not request browser, contact, message, or application actions/.test(error)));
});

test("agent review V2 allows needs_more_info but forbids execution directives", () => {
  const valid = validateAgentReviewOutput({
    selection: [{
      id: "candidate-1",
      decision: "needs_more_info",
      confidence: "medium",
      fit_summary: "AI Agent overlap is strong but salary is missing.",
      reason: "Missing salary and team scope.",
      matched_evidence: ["AI Agent", "RAG"],
      risk_flags: ["salary_missing"],
      missing_information: ["salary", "team scope"],
      suggested_user_question: "请确认薪资下限和团队方向。",
    }],
  }, { allowedIds: ["candidate-1"] });
  assert.deepEqual(valid.errors, []);

  const invalid = validateAgentReviewOutput({
    selection: [{
      id: "candidate-1",
      decision: "select",
      confidence: "high",
      reason: "打开浏览器并立即沟通 HR",
      risk: "none",
      candidate: { id: "candidate-1" },
    }],
  }, { allowedIds: ["candidate-1"] });
  assert(invalid.errors.some((error) => /external action|外部动作|must not/i.test(error)));
});
