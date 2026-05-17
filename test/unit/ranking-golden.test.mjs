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

test("AI Agent profile hard rejects low-fit job families and weak technical keyword matches", () => {
  const profile = loadRoleProfile(ROOT, "ai-agent-dev");

  const finance = scoreRecord({
    id: "finance-python",
    title: "金融量化编程师 Python Pine",
    cardText: "金融 贷款 理财 Python Pine",
  }, { profile });
  assert(finance.hardRejected.some((reason) => reason === "reject-term:金融"));

  const weakPython = scoreRecord({
    id: "weak-python",
    title: "Python开发工程师",
    cardText: "负责普通后台系统开发和维护脚本。",
  }, { profile });
  assert(weakPython.hardRejected.some((reason) => reason.startsWith("missing-required-any:")));

  const testEngineer = scoreRecord({
    id: "test-engineer",
    title: "中级测试工程师",
    cardText: "大模型 智能体 Python Agent 自动化",
  }, { profile });
  assert(testEngineer.hardRejected.some((reason) => reason === "reject-term:测试工程师"));

  const productManager = scoreRecord({
    id: "product-manager",
    title: "资深web3产品经理｜OTC 交易 × AI Agent",
    cardText: "负责 AI Agent 产品规划和交易业务需求。",
  }, { profile });
  assert(productManager.hardRejected.some((reason) => reason === "reject-term:产品经理"));

  const dailyRate = scoreRecord({
    id: "daily-rate",
    title: "智能体开发工程师 360元一天",
    cardText: "Python 智能体开发，按天结算。",
  }, { profile });
  assert(dailyRate.hardRejected.some((reason) => reason === "reject-term:元一天"));

  const relevant = scoreRecord({
    id: "agent-python",
    title: "Python开发【Agent智能体】",
    cardText: "负责 AI Agent、RAG、LLM 应用工程化。",
  }, { profile });
  assert.deepEqual(relevant.hardRejected, []);
  assert(relevant.score > weakPython.score);
});
