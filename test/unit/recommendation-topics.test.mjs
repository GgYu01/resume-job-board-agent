import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRecommendationTopicExpression,
  recommendationTopicSelectors,
} from "../../src/cli/recommendation-topics.mjs";

test("BOSS recommendation topic tabs are explicitly discoverable from the overview page", () => {
  assert.deepEqual(recommendationTopicSelectors("boss"), [".expect-list a.expect-item"]);
  assert.deepEqual(recommendationTopicSelectors("liepin"), []);
  assert.deepEqual(recommendationTopicSelectors("both"), [".expect-list a.expect-item"]);
});

test("recommendation topic browser expression clicks safe topic tabs and labels evidence", () => {
  const expression = buildRecommendationTopicExpression({ site: "both", maxTopics: 3, waitMs: 25 });

  assert.match(expression, /recommendation-topic-tab/);
  assert.match(expression, /\.expect-list a\.expect-item/);
  assert.match(expression, /element\.click\(\)/);
  assert.doesNotMatch(expression, /triggerContact|contactAction|button-not-found/i);
});
