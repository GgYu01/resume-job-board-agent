import assert from "node:assert/strict";
import test from "node:test";

import { mergeDetailRecords } from "../../dist/core/use-cases/extract-details.js";

test("mergeDetailRecords preserves ranking evidence and adds detail evidence", () => {
  const merged = mergeDetailRecords({
    selected: [{ id: "job-1", title: "AI Agent", score: 80 }],
    details: [{ id: "job-1", requirements: ["LLM", "RAG"], salary: "25-45K" }],
  });

  assert.equal(merged[0].salary, "25-45K");
  assert.deepEqual(merged[0].requirements, ["LLM", "RAG"]);
  assert.equal(merged[0].score, 80);
});
