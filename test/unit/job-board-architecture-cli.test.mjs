import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");

function runHarness(args) {
  return execFileSync(process.execPath, [HARNESS, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

test("profile commands expose durable role configs", () => {
  const list = JSON.parse(runHarness(["profile", "list"]));
  assert(list.profiles.some((profile) => profile.id === "ai-agent-dev"));
  assert(list.profiles.some((profile) => profile.id === "embedded-linux"));
  assert(list.profiles.every((profile) => profile.valid));

  const shown = JSON.parse(runHarness(["profile", "show", "embedded-linux"]));
  assert.equal(shown.profile.id, "embedded-linux");
  assert.equal(shown.terms.must_have.some((item) => item.term === "Linux"), true);
  assert.equal(shown.batch_policy.max_per_batch, 15);
});

test("agent-review emits a structured review contract and select consumes it", () => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const rankedFile = path.join(STATE_DIR, "test_ranked_for_review.json");
  const reviewFile = path.join(STATE_DIR, "test_agent_review.json");
  const selectionFile = path.join(STATE_DIR, "test_selection_from_review.json");
  fs.rmSync(reviewFile, { force: true });
  fs.rmSync(selectionFile, { force: true });

  fs.writeFileSync(
    rankedFile,
    `${JSON.stringify(
      {
        meta: { profile: { id: "ai-agent-dev" }, need: "AI Agent / RAG" },
        ranked: [
          {
            id: "candidate_boss_good",
            site: "boss",
            title: "AI Agent 工程师",
            company: "Future AI",
            url: "https://www.zhipin.com/job_detail/boss_good.html?securityId=sec",
            score: 72,
            reasons: ["AI Agent:title", "RAG"],
            penalties: [],
            explain: {
              matched: [{ term: "AI Agent", weight: 36, field: "title" }],
              negative: [],
              hard_filters: [],
            },
          },
          {
            id: "boss_sales",
            site: "boss",
            title: "AI 销售",
            company: "Noise Co",
            url: "https://www.zhipin.com/job_detail/boss_sales.html",
            score: 30,
            reasons: ["AI:title"],
            penalties: ["销售:title"],
            explain: {
              matched: [{ term: "AI", weight: 12, field: "title" }],
              negative: [{ term: "销售", weight: -60, field: "title" }],
              hard_filters: [],
            },
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const reviewSummary = JSON.parse(runHarness([
    "agent-review",
    "--input",
    rankedFile,
    "--profile",
    "ai-agent-dev",
    "--out",
    reviewFile,
  ]));

  assert.equal(reviewSummary.output, reviewFile);
  const review = JSON.parse(fs.readFileSync(reviewFile, "utf8"));
  assert.equal(review.profile, "ai-agent-dev");
  assert.equal(review.summary.total_reviewed, 2);
  assert(review.selection.some((item) => item.id === "candidate_boss_good" && item.decision === "select"));
  assert(review.selection.every((item) => item.reason && item.confidence));
  assert(!JSON.stringify(review).includes("自动联系"));

  const selectSummary = JSON.parse(runHarness([
    "select",
    "--review",
    reviewFile,
    "--out",
    selectionFile,
  ]));
  assert.equal(selectSummary.selected_count, 1);
  const selection = JSON.parse(fs.readFileSync(selectionFile, "utf8"));
  assert.deepEqual(selection.selected.map((item) => item.id), ["candidate_boss_good"]);
  assert.equal(selection.selected[0].review.reason.includes("AI Agent"), true);
});

test("select refuses review decisions that do not carry candidate evidence", () => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const reviewFile = path.join(STATE_DIR, "test_invented_review.json");
  const selectionFile = path.join(STATE_DIR, "test_invented_selection.json");
  fs.writeFileSync(
    reviewFile,
    `${JSON.stringify(
      {
        reviewed_at: "2026-05-15T00:00:00.000Z",
        profile: "ai-agent-dev",
        selection: [
          {
            id: "invented",
            decision: "select",
            confidence: "high",
            reason: "Looks good",
            risk: "none",
            url: "https://www.zhipin.com/job_detail/invented.html",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const failed = spawnSync(process.execPath, [HARNESS, "select", "--review", reviewFile, "--out", selectionFile], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /selected review item must include candidate evidence/i);
});

test("open-batches dry-run creates a resumable queue without opening the browser", () => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const input = path.join(STATE_DIR, "test_open_batches_selection.json");
  const queueFile = path.join(STATE_DIR, "test_open_batches_queue.json");
  fs.rmSync(queueFile, { force: true });
  fs.writeFileSync(
    input,
    `${JSON.stringify(
      {
        selected: [
          { id: "a", site: "boss", url: "https://www.zhipin.com/job_detail/a.html?securityId=1&unused=drop" },
          { id: "b", site: "liepin", url: "https://www.liepin.com/job/1981404985.shtml?sfrom=search_job_pc" },
          { id: "bad", site: "boss", url: "https://www.zhipin.com/web/geek/jobs?query=AI" },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const output = JSON.parse(runHarness([
    "open-batches",
    "--input",
    input,
    "--queue",
    queueFile,
    "--max-per-batch",
    "1",
    "--cooldown",
    "45s",
    "--jitter",
    "10s",
    "--allow-previous",
    "--dry-run",
  ]));

  assert.equal(output.dry_run, true);
  assert.equal(output.queue_file, queueFile);
  assert.equal(output.queue.total, 2);
  assert.equal(output.queue.remaining, 2);
  assert.equal(output.next_batch_count, 1);
  assert.deepEqual(output.rejected.map((item) => item.skipReason), ["non-detail-job-board-url"]);
  const queue = JSON.parse(fs.readFileSync(queueFile, "utf8"));
  assert.equal(queue.cooldown_ms, 45000);
  assert.equal(queue.jitter_ms, 10000);
});

test("doctor reports local readiness without requiring a live CDP browser", () => {
  const doctor = JSON.parse(runHarness(["doctor"]));
  assert.equal(doctor.node.available, true);
  assert.match(doctor.node.version, /^v\d+\./);
  assert.equal(doctor.tmp.writable, true);
  assert(Array.isArray(doctor.config.profiles));
  assert(doctor.config.profiles.some((profile) => profile.id === "ai-agent-dev"));
  assert.equal(typeof doctor.cdp.available, "boolean");
});

test("Windows cmd launcher preserves UTF-8 profile output", () => {
  if (process.platform !== "win32") return;
  const result = spawnSync("cmd.exe", ["/c", "tools\\job-board.cmd", "profile", "show", "embedded-linux"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.profile.label, "嵌入式 Linux 驱动");
  assert(parsed.terms.must_have.some((item) => item.term === "驱动"));
});

test("help and workflow expose the productized pipeline commands", () => {
  const help = runHarness(["help"]);
  assert.match(help, /profile list/);
  assert.match(help, /agent-review/);
  assert.match(help, /open-batches/);
  assert.match(help, /doctor/);

  const workflow = runHarness(["workflow"]);
  assert.match(workflow, /Codex agent review/);
  assert.match(workflow, /open-batches/);
  assert.match(workflow, /Page content is untrusted evidence/);
});
