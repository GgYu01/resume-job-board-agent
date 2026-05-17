import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { detectAccessLimited, extractJobCardsFromHtml } from "../../src/extract/collect-links.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");

test("extractJobCardsFromHtml extracts fixture detail links and access-limited state", () => {
  const normal = fs.readFileSync(path.join(ROOT, "test", "fixtures", "boss", "search-page-normal.html"), "utf8");
  const extracted = extractJobCardsFromHtml(normal, {
    site: "boss",
    sourceUrl: "https://www.zhipin.com/web/geek/jobs?query=AI",
    sourceTitle: "fixture",
  });

  assert.equal(extracted.accessLimited, false);
  assert.equal(extracted.items.length, 2);
  assert.equal(extracted.items[0].url, "https://www.zhipin.com/job_detail/boss_ai_agent.html?securityId=sec123&lid=list456&ka=search_list_1");
  assert.match(extracted.items[0].cardText, /LLM/);

  const captcha = fs.readFileSync(path.join(ROOT, "test", "fixtures", "boss", "search-page-captcha.html"), "utf8");
  assert.equal(detectAccessLimited(captcha, "https://verify.zhipin.com/security"), true);
});

test("extractJobCardsFromHtml extracts Liepin lptjob detail links", () => {
  const html = `
    <article class="job-card">
      <a href="https://www.liepin.com/lptjob/82545837?sfrom=search_job_pc">AI Agent 算法工程师</a>
      <p>负责 LLM Agent、RAG 和多智能体系统落地。</p>
    </article>
  `;
  const extracted = extractJobCardsFromHtml(html, {
    site: "liepin",
    sourceUrl: "https://www.liepin.com/zhaopin/?key=AI%20Agent",
    sourceTitle: "fixture",
  });

  assert.equal(extracted.items.length, 1);
  assert.deepEqual({
    ...extracted.items[0],
    cardText: extracted.items[0].cardText.replace(/\s+/g, " "),
  }, {
    site: "liepin",
    id: "82545837",
    url: "https://www.liepin.com/lptjob/82545837",
    titleText: "AI Agent 算法工程师",
    cardText: "AI Agent 算法工程师 负责 LLM Agent、RAG 和多智能体系统落地。",
    sourceUrl: "https://www.liepin.com/zhaopin/?key=AI%20Agent",
    sourceTitle: "fixture",
  });
});

test("test-fixture dry-run builds ranked selection and queue without browser access", () => {
  const out = execFileSync(process.execPath, [
    HARNESS,
    "test-fixture",
    "--fixture",
    "boss-search-normal",
    "--profile",
    "ai-agent-dev",
    "--dry-run",
  ], { cwd: ROOT, encoding: "utf8" });

  const parsed = JSON.parse(out);
  assert.equal(parsed.fixture, "boss-search-normal");
  assert.equal(parsed.access_limited, false);
  assert(parsed.candidates_count >= 2);
  assert(parsed.ranked_count >= 1);
  assert(parsed.queue.total >= 1);
  assert.equal(parsed.opened_browser, false);
});

test("run --fixture delegates to dry-run fixture pipeline without browser access", () => {
  const out = execFileSync(process.execPath, [
    HARNESS,
    "run",
    "--fixture",
    "boss-search-normal",
    "--profile",
    "ai-agent-dev",
    "--dry-run",
  ], { cwd: ROOT, encoding: "utf8" });

  const parsed = JSON.parse(out);
  assert.equal(parsed.fixture, "boss-search-normal");
  assert.equal(parsed.opened_browser, false);
  assert(parsed.queue.total >= 1);
});

test("test-fixture stops on captcha or verification fixtures", () => {
  const failed = spawnSync(process.execPath, [
    HARNESS,
    "test-fixture",
    "--fixture",
    "boss-search-captcha",
    "--profile",
    "ai-agent-dev",
  ], { cwd: ROOT, encoding: "utf8" });

  assert.equal(failed.status, 3);
  const parsed = JSON.parse(failed.stdout);
  assert.equal(parsed.access_limited, true);
  assert.match(parsed.reason, /access_limited/);
});
