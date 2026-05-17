import assert from "node:assert/strict";
import test from "node:test";

import { createOpenQueue, nextBatch, parseDurationMs, pauseQueue } from "../../src/batch/queue.mjs";
import { loadRoleProfile } from "../../src/config/load-config.mjs";
import { redactSensitiveEvidence } from "../../src/privacy/redact.mjs";
import { scoreRecord } from "../../src/rank/keyword-ranker.mjs";
import { canonicalJobUrl, isGenericJobBoardUrl, recordKey } from "../../src/sites/index.mjs";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

test("canonicalJobUrl accepts only detail pages and preserves BOSS context params", () => {
  const boss = canonicalJobUrl("https://www.zhipin.com/job_detail/abc123.html?securityId=sec~~1&lid=2&ka=job_list&unused=drop");
  assert.deepEqual(boss, {
    site: "boss",
    id: "abc123",
    url: "https://www.zhipin.com/job_detail/abc123.html?securityId=sec~~1&lid=2&ka=job_list",
  });

  const liepin = canonicalJobUrl("https://www.liepin.com/job/1981404985.shtml?sfrom=search_job_pc");
  assert.deepEqual(liepin, {
    site: "liepin",
    id: "1981404985",
    url: "https://www.liepin.com/job/1981404985.shtml",
  });
  const liepinLptJob = canonicalJobUrl("https://www.liepin.com/lptjob/82545837?sfrom=search_job_pc&d_sfrom=search_fp");
  assert.deepEqual(liepinLptJob, {
    site: "liepin",
    id: "82545837",
    url: "https://www.liepin.com/lptjob/82545837",
  });

  assert.equal(canonicalJobUrl("https://www.zhipin.com/web/geek/jobs?query=AI"), null);
  assert.equal(isGenericJobBoardUrl("https://www.zhipin.com/web/geek/jobs?query=AI"), true);
  assert.equal(recordKey({ url: "https://www.liepin.com/job/1981404985.shtml?sfrom=x" }), "liepin:1981404985");
  assert.equal(recordKey({ url: "https://www.liepin.com/lptjob/82545837?sfrom=x" }), "liepin:82545837");
});

test("profile ranking explains positive and negative evidence", () => {
  const profile = loadRoleProfile(ROOT, "embedded-linux");
  const good = scoreRecord({
    title: "嵌入式 Linux 驱动工程师",
    company: "Chip Co",
    cardText: "负责 Android BSP、HAL、内核驱动调试。",
  }, { profile });
  assert(good.score > 40);
  assert(good.explain.matched.some((item) => item.term === "Linux"));
  assert(good.explain.matched.some((item) => item.term === "驱动"));

  const bad = scoreRecord({
    title: "Linux 培训讲师",
    company: "Training Co",
    cardText: "课程销售和学员客服。",
  }, { profile });
  assert(bad.score < good.score);
  assert(bad.explain.negative.some((item) => item.term === "销售"));
});

test("open queue slices batches, parses cooldowns, and preserves pause state", () => {
  const queue = createOpenQueue([
    { id: "a", url: "https://www.zhipin.com/job_detail/a.html" },
    { id: "b", url: "https://www.zhipin.com/job_detail/b.html" },
  ], { max_per_batch: 1, cooldown_ms: parseDurationMs("45s", 0), jitter_ms: parseDurationMs("10s", 0) });

  assert.equal(queue.cooldown_ms, 45000);
  assert.equal(queue.jitter_ms, 10000);
  assert.equal(nextBatch(queue).length, 1);
  pauseQueue(queue, "access_limited");
  assert.equal(queue.status, "paused");
  assert.equal(queue.reason, "access_limited");
});

test("redactSensitiveEvidence removes contact values by default", () => {
  const redacted = redactSensitiveEvidence("微信 wxid_abcd1234，电话 13812345678，邮箱 hr@example.com");
  assert(!redacted.includes("wxid_abcd1234"));
  assert(!redacted.includes("13812345678"));
  assert(!redacted.includes("hr@example.com"));
  assert(redacted.includes("[phone-redacted]"));
});
