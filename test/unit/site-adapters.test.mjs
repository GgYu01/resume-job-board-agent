import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { extractJobCardsFromHtml } from "../../src/extract/collect-links.mjs";
import { bossAdapter } from "../../src/sites/boss.mjs";
import { job51Adapter } from "../../src/sites/job51.mjs";
import { liepinAdapter } from "../../src/sites/liepin.mjs";
import { getSiteAdapter, listSiteAdapters } from "../../src/sites/registry.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("site adapters expose canonical detail and access-limit behavior", () => {
  assert.equal(bossAdapter.isSearchUrl("https://www.zhipin.com/web/geek/jobs?query=AI"), true);
  assert.equal(bossAdapter.isDetailUrl("https://www.zhipin.com/job_detail/abc.html?securityId=sec"), true);
  assert.equal(
    bossAdapter.canonicalizeDetailUrl("https://www.zhipin.com/job_detail/abc.html?securityId=sec&unused=1"),
    "https://www.zhipin.com/job_detail/abc.html?securityId=sec",
  );
  assert.equal(bossAdapter.detectAccessLimited("安全验证 验证码", "https://verify.zhipin.com"), true);

  assert.equal(liepinAdapter.isSearchUrl("https://www.liepin.com/zhaopin/?key=AI"), true);
  assert.equal(liepinAdapter.isDetailUrl("https://www.liepin.com/job/1981404985.shtml?sfrom=x"), true);
  assert.equal(
    liepinAdapter.canonicalizeDetailUrl("https://www.liepin.com/job/1981404985.shtml?sfrom=x"),
    "https://www.liepin.com/job/1981404985.shtml",
  );
  assert.equal(liepinAdapter.detectAccessLimited("captcha verify", "https://safe.liepin.com"), true);

  assert.equal(job51Adapter.isSearchUrl("https://search.51job.com/list/040000,000000,0000,00,9,99,AI,2,1.html"), true);
  assert.equal(job51Adapter.isDetailUrl("https://jobs.51job.com/shenzhen/155512345.html?s=sou_sou_soulb"), true);
  assert.equal(
    job51Adapter.canonicalizeDetailUrl("https://jobs.51job.com/shenzhen/155512345.html?s=sou_sou_soulb"),
    "https://jobs.51job.com/shenzhen/155512345.html",
  );
  assert.equal(getSiteAdapter("51job").id, "51job");
  assert(listSiteAdapters().some((adapter) => adapter.id === "51job"));
});

test("51job fixture extraction produces canonical candidates", () => {
  const html = fs.readFileSync(path.join(ROOT, "test", "fixtures", "51job", "search-page-normal.html"), "utf8");
  const extracted = extractJobCardsFromHtml(html, {
    site: "51job",
    sourceUrl: "https://search.51job.com/list/040000,000000,0000,00,9,99,AI,2,1.html",
    sourceTitle: "51job search",
  });
  assert.equal(extracted.items.length, 1);
  assert.equal(extracted.items[0].site, "51job");
  assert.equal(extracted.items[0].url, "https://jobs.51job.com/shenzhen/155512345.html");
});
