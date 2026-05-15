import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { extractDetailFromHtml } from "../../src/extract/extract-detail.mjs";
import { loadRoleProfile } from "../../src/config/load-config.mjs";
import { scoreRecord } from "../../src/rank/keyword-ranker.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");

test("extractDetailFromHtml parses core fields and keeps requirements as rank evidence", () => {
  const html = fs.readFileSync(path.join(ROOT, "test", "fixtures", "boss", "detail-page-normal.html"), "utf8");
  const detail = extractDetailFromHtml(html, {
    site: "boss",
    url: "https://www.zhipin.com/job_detail/boss_ai_agent.html",
  });

  assert.equal(detail.accessLimited, false);
  assert.equal(detail.title, "AI Agent 工程师");
  assert.equal(detail.company, "Future AI");
  assert.equal(detail.salary, "25-45K");
  assert.match(detail.location, /深圳/);
  assert.match(detail.requirements, /MCP/);

  const profile = loadRoleProfile(ROOT, "ai-agent-dev");
  const score = scoreRecord({ id: "detail", ...detail }, { profile });
  assert(score.score > 40);
  assert(score.explain.matched.some((item) => item.term === "MCP"));
});

test("extract-details command enriches selection from fixtures without opening browser", () => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const input = path.join(STATE_DIR, "test_detail_selection.json");
  const output = path.join(STATE_DIR, "test_detail_output.json");
  fs.writeFileSync(input, `${JSON.stringify({
    selected: [
      {
        id: "boss_ai_agent",
        site: "boss",
        url: "https://www.zhipin.com/job_detail/boss_ai_agent.html?securityId=sec",
      },
    ],
  }, null, 2)}\n`, "utf8");

  const summary = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "extract-details",
    "--input",
    input,
    "--fixture-dir",
    path.join(ROOT, "test", "fixtures"),
    "--out",
    output,
    "--dry-run",
  ], { cwd: ROOT, encoding: "utf8" }));

  assert.equal(summary.output, output);
  assert.equal(summary.detail_count, 1);
  assert.equal(summary.opened_browser, false);
  const details = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(details.details[0].title, "AI Agent 工程师");
  assert.match(details.details[0].requirements, /workflow automation/);
});
