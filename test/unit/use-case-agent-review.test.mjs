import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentReviewInput } from "../../dist/core/use-cases/build-agent-review.js";

test("buildAgentReviewInput limits candidates and preserves no-external-actions guardrail", () => {
  const request = buildAgentReviewInput({
    profileId: "ai-agent-dev",
    topN: 1,
    candidates: [{ id: "a" }, { id: "b" }],
  });

  assert.equal(request.profile_id, "ai-agent-dev");
  assert.deepEqual(request.candidates, [{ id: "a" }]);
  assert.equal(request.guardrails.no_external_actions, true);
});
