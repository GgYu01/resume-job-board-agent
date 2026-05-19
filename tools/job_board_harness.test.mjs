import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");

test("summarize-contacts selects exchanged contacts and likely interview followups", () => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const input = path.join(STATE_DIR, "test_followups_input.json");
  const output = path.join(STATE_DIR, "test_followups_output.json");
  fs.rmSync(output, { force: true });
  fs.rmSync(output.replace(/\.json$/i, ".md"), { force: true });

  fs.writeFileSync(
    input,
    `${JSON.stringify(
      {
        items: [
          {
            site: "boss",
            person: "张经理",
            company: "深蓝科技",
            position: "AI Agent 工程师",
            url: "https://www.zhipin.com/web/geek/chat?id=1",
            chatText:
              "双方已经互加微信，微信 wxid_zhang123。明天下午安排技术面，继续聊 Agent 工程化和本地部署。",
          },
          {
            site: "liepin",
            person: "王顾问",
            company: "未来智能",
            position: "云原生 SRE",
            url: "https://www.liepin.com/message/2",
            chatText:
              "候选人背景匹配，HR 说下周约电话深入沟通，然后推进面试流程。联系电话 13812345678。",
          },
          {
            site: "boss",
            person: "李HR",
            company: "普通外包",
            position: "驻场运维",
            url: "https://www.zhipin.com/web/geek/chat?id=3",
            chatText: "薪资不合适，先不推进，后续有机会再联系。",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  execFileSync(process.execPath, [
    HARNESS,
    "summarize-contacts",
    "--input",
    input,
    "--out",
    output,
    "--max",
    "5",
  ], { cwd: ROOT, encoding: "utf8" });

  const summary = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(summary.selected.length, 2);
  assert.deepEqual(summary.selected.map((item) => item.person), ["张经理", "王顾问"]);
  assert.equal(summary.selected[0].bucket, "contact-exchanged");
  assert(summary.selected[1].buckets.includes("interview-likely"));
  assert.equal(summary.skipped[0].person, "李HR");
  assert.equal(summary.skipped[0].skipReason, "low-followup-score");
  assert(!JSON.stringify(summary).includes("wxid_zhang123"));
  assert(!JSON.stringify(summary).includes("13812345678"));
  assert(fs.existsSync(output.replace(/\.json$/i, ".md")));
});

test("workflow documents summarize-contacts durable login boundary and relogin path", () => {
  const workflow = execFileSync(process.execPath, [HARNESS, "workflow"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  assert.match(workflow, /summarize-contacts uses the same durable Edge Beta profile/);
  assert.match(workflow, /login or verification is required/);
  assert.match(workflow, /finish it in Edge and rerun auth/);
  assert.match(workflow, /closes BOSS\/Liepin search\/list pages/);
});

test("open dry-run keeps only detail pages and preserves BOSS securityId", () => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const input = path.join(STATE_DIR, "test_open_detail_urls_input.json");
  const bossId = "65bbd39426dfd2eb0ndy2Nq1GVVZ";

  fs.writeFileSync(
    input,
    `${JSON.stringify(
      {
        selected: [
          {
            site: "boss",
            url: `https://www.zhipin.com/job_detail/${bossId}.html?securityId=sec~~123&ka=company_more_job_${bossId}&unused=drop`,
          },
          {
            site: "boss",
            url: "https://www.zhipin.com/web/geek/jobs?query=AI%20Agent",
          },
          {
            site: "liepin",
            url: "https://www.liepin.com/zhaopin/?key=AI%20Agent",
          },
          {
            site: "liepin",
            url: "https://www.liepin.com/job/1981404985.shtml?sfrom=search_job_pc",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const output = execFileSync(process.execPath, [
    HARNESS,
    "open",
    "--dry-run",
    "--allow-previous",
    "--input",
    input,
  ], { cwd: ROOT, encoding: "utf8" });

  const parsed = JSON.parse(output);
  assert.equal(parsed.would_open_count, 2);
  assert.deepEqual(parsed.records.map((record) => record.url), [
    `https://www.zhipin.com/job_detail/${bossId}.html?securityId=sec~~123&ka=company_more_job_${bossId}`,
    "https://www.liepin.com/job/1981404985.shtml",
  ]);
  assert.deepEqual(parsed.rejected.map((record) => record.skipReason), [
    "non-detail-job-board-url",
    "non-detail-job-board-url",
  ]);
});

test("open dry-run reports no new jobs when every record is previously opened", () => {
  const stateDir = fs.mkdtempSync(path.join(STATE_DIR, "test_no_new_jobs_"));
  const input = path.join(stateDir, "selection.json");
  const openedId = "previously_seen";
  fs.writeFileSync(path.join(stateDir, "opened_ids.txt"), `boss:${openedId}\n`, "utf8");
  fs.writeFileSync(
    input,
    `${JSON.stringify(
      {
        selected: [
          {
            site: "boss",
            title: "AI Agent 工程师",
            company: "Future AI",
            url: `https://www.zhipin.com/job_detail/${openedId}.html?securityId=sec`,
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const output = execFileSync(process.execPath, [
    HARNESS,
    "open",
    "--dry-run",
    "--input",
    input,
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, JOB_BOARD_HARNESS_STATE_DIR: stateDir },
  });

  const parsed = JSON.parse(output);
  assert.equal(parsed.status, "no-new-jobs");
  assert.equal(parsed.would_open_count, 0);
  assert.equal(parsed.rejected[0].skipReason, "already-opened");
});

test("followup-recheck dry-run reports due pending queue entries", () => {
  const stateDir = fs.mkdtempSync(path.join(STATE_DIR, "test_followup_recheck_"));
  const queue = path.join(stateDir, "followup_recheck_queue.json");
  const receipt = path.join(stateDir, "followup_recheck_dry_run.json");
  fs.writeFileSync(
    queue,
    `${JSON.stringify(
      {
        schema: "job-board-followup-recheck/v1",
        createdAt: "2026-05-19T00:00:00.000Z",
        updatedAt: "2026-05-19T00:00:00.000Z",
        items: [
          {
            key: "boss:due",
            site: "boss",
            id: "due",
            canonical_id: "due",
            url: "https://www.zhipin.com/job_detail/due.html",
            title: "Software Engineer LLM",
            recruiter: "Ms Liu",
            pendingActions: ["resume", "wechat"],
            status: "pending",
            nextCheckAt: "2026-05-18T00:00:00.000Z",
          },
          {
            key: "boss:done",
            site: "boss",
            id: "done",
            url: "https://www.zhipin.com/job_detail/done.html",
            pendingActions: ["resume"],
            status: "completed",
            nextCheckAt: "2026-05-18T00:00:00.000Z",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const output = execFileSync(process.execPath, [
    HARNESS,
    "followup-recheck",
    "--queue",
    queue,
    "--dry-run",
    "--max",
    "5",
    "--out",
    receipt,
  ], { cwd: ROOT, encoding: "utf8" });

  const parsed = JSON.parse(output);
  assert.equal(parsed.dry_run, true);
  assert.equal(parsed.pending_count, 1);
  assert.equal(parsed.next_count, 1);
  assert.deepEqual(parsed.next.map((item) => item.key), ["boss:due"]);
  const written = JSON.parse(fs.readFileSync(receipt, "utf8"));
  assert.equal(written.dry_run, true);
  assert.deepEqual(written.next.map((item) => item.key), ["boss:due"]);
});

test("help exposes search/list cleanup controls", () => {
  const help = execFileSync(process.execPath, [HARNESS, "help"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  assert.match(help, /cleanup-pages/);
  assert.match(help, /--keep-search-pages/);
  assert.match(help, /--trigger-contact/);
  assert.match(help, /--keep-contact-pages/);
  assert.match(help, /followup-recheck/);
});
