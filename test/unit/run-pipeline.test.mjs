import assert from "node:assert/strict";
import test from "node:test";

import { defaultStageGraph, resolveStageGraph } from "../../dist/core/pipeline/stage-graph.js";

test("default run graph includes detail extraction and second ranking", () => {
  assert.deepEqual(defaultStageGraph(), [
    "auth",
    "collect",
    "rank_candidates",
    "extract_details",
    "rank_details",
    "agent_review",
    "select",
    "open_batches",
  ]);
});

test("skip details removes both detail extraction and rank details", () => {
  assert.deepEqual(resolveStageGraph({ skipDetails: true }), [
    "auth",
    "collect",
    "rank_candidates",
    "agent_review",
    "select",
    "open_batches",
  ]);
});
