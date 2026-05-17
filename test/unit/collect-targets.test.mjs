import assert from "node:assert/strict";
import test from "node:test";

import { classifyCollectTargets } from "../../src/cli/collect-targets.mjs";

test("seeded collect only evaluates seeded target ids instead of every same-host tab", () => {
  const result = classifyCollectTargets([
    {
      id: "seed-boss",
      type: "page",
      url: "https://www.zhipin.com/c101220100-p100109/?page=14",
      title: "合肥Python招聘",
      webSocketDebuggerUrl: "ws://seed",
    },
    {
      id: "old-generic",
      type: "page",
      url: "https://www.zhipin.com/web/geek/jobs",
      title: "旧的泛搜索页",
      webSocketDebuggerUrl: "ws://old",
    },
    {
      id: "old-detail",
      type: "page",
      url: "https://www.zhipin.com/job_detail/noise.html",
      title: "旧详情页推荐区",
      webSocketDebuggerUrl: "ws://detail",
    },
  ], {
    site: "boss",
    seedUrls: ["https://www.zhipin.com/c101220100-p100109/?page=14"],
    seeded: [{ targetId: "seed-boss", url: "https://www.zhipin.com/c101220100-p100109/?page=14" }],
  });

  assert.deepEqual(result.selected.map((item) => item.id), ["seed-boss"]);
  assert.equal(result.selected[0].collectionReason, "seeded-url");
  assert.deepEqual(result.skipped.map((item) => item.reason), [
    "not-seeded-target",
    "not-seeded-target",
  ]);
});

test("default collect skips detail-page recommendations unless explicitly requested", () => {
  const targets = [
    {
      id: "search",
      type: "page",
      url: "https://www.liepin.com/city-hefei/career/rengongzhineng/?page=1",
      title: "合肥人工智能招聘",
      webSocketDebuggerUrl: "ws://search",
    },
    {
      id: "detail",
      type: "page",
      url: "https://www.liepin.com/job/1980841275.shtml",
      title: "详情页推荐区",
      webSocketDebuggerUrl: "ws://detail",
    },
  ];

  const strict = classifyCollectTargets(targets, { site: "liepin" });
  assert.deepEqual(strict.selected.map((item) => item.id), ["search"]);
  assert.deepEqual(strict.skipped.map((item) => item.reason), ["detail-recommendations-disabled"]);

  const withRecommendations = classifyCollectTargets(targets, { site: "liepin", includeRecommendations: true });
  assert.deepEqual(withRecommendations.selected.map((item) => item.id), ["search", "detail"]);
  assert.deepEqual(withRecommendations.selected.map((item) => item.collectionReason), [
    "search-list-tab",
    "detail-recommendations",
  ]);
});
