import assert from "node:assert/strict";
import test from "node:test";

import { contactActionLabels, contactTriggerExpression } from "../../src/sites/contact-actions.mjs";

test("contact action labels target only explicit default-message buttons", () => {
  assert.deepEqual(contactActionLabels("boss"), ["立即沟通"]);
  assert.deepEqual(contactActionLabels("liepin"), ["聊一聊"]);
  assert.deepEqual(contactActionLabels("51job"), []);
});

test("contact trigger expression carries the site-specific button label", () => {
  assert.match(contactTriggerExpression("boss"), /\\u7acb\\u5373\\u6c9f\\u901a/);
  assert.match(contactTriggerExpression("liepin"), /\\u804a\\u4e00\\u804a/);
});
