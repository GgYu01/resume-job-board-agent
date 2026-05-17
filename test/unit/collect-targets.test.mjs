import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCollectTargets,
  isCollectableRecommendationUrl,
  recommendationPageUrls,
} from "../../src/cli/collect-targets.mjs";

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

test("collect classifies first-party recommendation list pages as a screening source", () => {
  const targets = [
    {
      id: "boss-recommend",
      type: "page",
      url: "https://www.zhipin.com/web/geek/jobs",
      title: "BOSS 推荐职位",
      webSocketDebuggerUrl: "ws://boss-recommend",
    },
    {
      id: "boss-search",
      type: "page",
      url: "https://www.zhipin.com/web/geek/jobs?query=AI%20Agent&city=101280600",
      title: "BOSS AI Agent 搜索",
      webSocketDebuggerUrl: "ws://boss-search",
    },
    {
      id: "liepin-recommend",
      type: "page",
      url: "https://www.liepin.com/zhaopin/",
      title: "猎聘推荐职位",
      webSocketDebuggerUrl: "ws://liepin-recommend",
    },
    {
      id: "liepin-search",
      type: "page",
      url: "https://www.liepin.com/zhaopin/?key=RAG",
      title: "猎聘 RAG 搜索",
      webSocketDebuggerUrl: "ws://liepin-search",
    },
  ];

  const result = classifyCollectTargets(targets, { site: "both" });
  assert.deepEqual(result.selected.map((item) => [item.id, item.collectionReason]), [
    ["boss-recommend", "recommendation-list-tab"],
    ["boss-search", "search-list-tab"],
    ["liepin-recommend", "recommendation-list-tab"],
    ["liepin-search", "search-list-tab"],
  ]);
});

test("recommendation page seeds keep recommendation evidence in strict seeded collection", () => {
  const recommendationUrls = recommendationPageUrls("both");
  assert(recommendationUrls.includes("https://www.zhipin.com/web/geek/jobs"));
  assert(recommendationUrls.includes("https://www.liepin.com/zhaopin/"));
  assert.equal(isCollectableRecommendationUrl("https://www.zhipin.com/web/geek/jobs"), true);
  assert.equal(isCollectableRecommendationUrl("https://www.zhipin.com/web/geek/jobs?query=AI"), false);
  assert.equal(isCollectableRecommendationUrl("https://www.liepin.com/zhaopin/"), true);
  assert.equal(isCollectableRecommendationUrl("https://www.liepin.com/zhaopin/?key=AI"), false);

  const result = classifyCollectTargets([
    {
      id: "user-seed",
      type: "page",
      url: "https://www.zhipin.com/web/geek/jobs?query=AI%20Agent",
      title: "user search",
      webSocketDebuggerUrl: "ws://user-seed",
    },
    {
      id: "boss-recommend",
      type: "page",
      url: "https://www.zhipin.com/web/geek/jobs",
      title: "BOSS recommend",
      webSocketDebuggerUrl: "ws://boss-recommend",
    },
    {
      id: "old-search",
      type: "page",
      url: "https://www.liepin.com/zhaopin/?key=Noise",
      title: "old search",
      webSocketDebuggerUrl: "ws://old-search",
    },
  ], {
    site: "both",
    seedUrls: ["https://www.zhipin.com/web/geek/jobs?query=AI%20Agent"],
    seeded: [{ targetId: "user-seed" }],
    recommendationUrls: ["https://www.zhipin.com/web/geek/jobs"],
    seededRecommendations: [{ targetId: "boss-recommend" }],
  });

  assert.deepEqual(result.selected.map((item) => [item.id, item.collectionReason]), [
    ["user-seed", "seeded-url"],
    ["boss-recommend", "recommendation-list-tab"],
  ]);
  assert.deepEqual(result.skipped.map((item) => item.reason), ["not-seeded-target"]);
});

test("collect target classification skips duplicate page URLs before evaluation", () => {
  const result = classifyCollectTargets([
    {
      id: "recommend-new",
      type: "page",
      url: "https://www.zhipin.com/web/geek/jobs",
      title: "BOSS recommend new",
      webSocketDebuggerUrl: "ws://recommend-new",
    },
    {
      id: "recommend-old",
      type: "page",
      url: "https://www.zhipin.com/web/geek/jobs",
      title: "BOSS recommend old",
      webSocketDebuggerUrl: "ws://recommend-old",
    },
  ], { site: "boss" });

  assert.deepEqual(result.selected.map((item) => item.id), ["recommend-new"]);
  assert.deepEqual(result.skipped.map((item) => item.reason), ["duplicate-target-url"]);
});
