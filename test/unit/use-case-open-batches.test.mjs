import assert from "node:assert/strict";
import test from "node:test";

import { planOpenBatch } from "../../dist/core/use-cases/open-batches.js";

test("open batch dry-run never requests browser mutation", () => {
  const result = planOpenBatch({
    queue: { items: [{ index: 0, status: "pending", record: { id: "job-1", url: "https://www.zhipin.com/job_detail/job-1.html" } }] },
    openedKeys: new Set(),
    options: { dryRun: true, maxPerBatch: 10, triggerContact: false },
  });

  assert.equal(result.category, "success");
  assert.equal(result.payload.toOpen.length, 1);
  assert.equal(result.payload.browserMutationAllowed, false);
});

test("trigger contact is blocked without explicit allowExternalAction", () => {
  const result = planOpenBatch({
    queue: { items: [{ index: 0, status: "pending", record: { id: "job-1", url: "https://www.zhipin.com/job_detail/job-1.html" } }] },
    openedKeys: new Set(),
    options: { dryRun: false, maxPerBatch: 10, triggerContact: true, allowExternalAction: false },
  });

  assert.equal(result.category, "external_action_blocked");
  assert.equal(result.exitCode, 5);
});
