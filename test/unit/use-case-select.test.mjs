import assert from "node:assert/strict";
import test from "node:test";

import { selectReviewedCandidates } from "../../dist/core/use-cases/select-candidates.js";

test("selectReviewedCandidates rejects invented ids and returns selected/rejected ids", () => {
  const result = selectReviewedCandidates({
    ranked: [{ id: "a" }, { id: "b" }],
    review: {
      selection: [
        { id: "a", decision: "select" },
        { id: "invented", decision: "select" },
      ],
    },
  });

  assert.deepEqual(result.selectedIds, ["a"]);
  assert.deepEqual(result.rejectedIds, ["b"]);
});
