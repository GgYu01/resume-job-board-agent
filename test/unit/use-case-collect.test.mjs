import assert from "node:assert/strict";
import test from "node:test";

import { collectCandidatesFromTargets } from "../../dist/core/use-cases/collect-candidates.js";

test("collectCandidatesFromTargets merges page records and access-limit state", async () => {
  const result = await collectCandidatesFromTargets({
    targets: [{ id: "1", url: "https://www.zhipin.com/web/geek/jobs", title: "BOSS", type: "page" }],
    evaluate: async () => ({
      accessLimited: false,
      items: [{ site: "boss", id: "job-1", url: "https://www.zhipin.com/job_detail/job-1.html", titleText: "AI Agent" }],
    }),
  });

  assert.equal(result.category, "success");
  assert.equal(result.payload.items.length, 1);
});

test("collectCandidatesFromTargets returns access_limited when any target is limited", async () => {
  const result = await collectCandidatesFromTargets({
    targets: [{ id: "1", url: "https://www.zhipin.com/web/geek/jobs", title: "BOSS", type: "page" }],
    evaluate: async () => ({ accessLimited: true, items: [] }),
  });

  assert.equal(result.category, "access_limited");
  assert.equal(result.exitCode, 3);
});
