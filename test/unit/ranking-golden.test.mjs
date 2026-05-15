import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadRoleProfile } from "../../src/config/load-config.mjs";
import { scoreRecord } from "../../src/rank/keyword-ranker.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("AI Agent ranking golden keeps relevant jobs above sales noise with explain evidence", () => {
  const profile = loadRoleProfile(ROOT, "ai-agent-dev");
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "test", "fixtures", "ranking", "ai-agent-candidates.json"), "utf8"));
  const ranked = fixture.items
    .map((record) => ({ ...record, ...scoreRecord(record, { profile }) }))
    .sort((a, b) => b.score - a.score);

  assert.equal(ranked[0].id, "good-agent");
  assert(ranked[0].explain.matched.some((item) => item.term === "AI Agent"));
  assert(ranked[0].explain.matched.length > 0);
  assert.equal(ranked.some((item, index) => item.id === "noise-sales" && index < 1), false);
  const sales = ranked.find((item) => item.id === "noise-sales");
  assert(sales.explain.negative.some((item) => item.term === "销售"));
});
