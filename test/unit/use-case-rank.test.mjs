import assert from "node:assert/strict";
import test from "node:test";

import { rankCandidates } from "../../dist/core/use-cases/rank-candidates.js";

test("rankCandidates scores fixture-like records without browser access", () => {
  const result = rankCandidates({
    records: [{
      site: "boss",
      id: "boss_ai_agent",
      titleText: "AI Agent 工程师",
      cardText: "负责 LLM、RAG、浏览器自动化。",
      url: "https://www.zhipin.com/job_detail/boss_ai_agent.html",
    }],
    profile: {
      include: ["AI Agent", "LLM", "RAG"],
      exclude: ["销售"],
      hard_filters: {},
    },
    options: { max: 15, minScore: 8 },
  });

  assert.equal(result.selected.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.selected[0].canonical_key, "boss:boss_ai_agent");
});
