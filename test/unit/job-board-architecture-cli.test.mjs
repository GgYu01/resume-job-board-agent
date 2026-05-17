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

function runHarness(args, options = {}) {
  return execFileSync(process.execPath, [HARNESS, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: options.env || process.env,
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
  const stateDir = fs.mkdtempSync(path.join(STATE_DIR, "test_agent_review_state_"));
  const env = { ...process.env, JOB_BOARD_HARNESS_STATE_DIR: stateDir };
  const rankedFile = path.join(stateDir, "test_ranked_for_review.json");
  const reviewFile = path.join(stateDir, "test_agent_review.json");
  const selectionFile = path.join(stateDir, "test_selection_from_review.json");
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
  ], { env }));

  assert.equal(reviewSummary.output, reviewFile);
  const review = JSON.parse(fs.readFileSync(reviewFile, "utf8"));
  assert.equal(review.profile, "ai-agent-dev");
  assert.equal(review.review_mode, "rule_fallback");
  assert.equal(review.semantic_review, false);
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
  ], { env }));
  assert.equal(selectSummary.selected_count, 1);
  const selection = JSON.parse(fs.readFileSync(selectionFile, "utf8"));
  assert.deepEqual(selection.selected.map((item) => item.id), ["candidate_boss_good"]);
  assert.equal(selection.meta.review_mode, "rule_fallback");
  assert.equal(selection.meta.semantic_review, false);
  assert.equal(selection.selected[0].semantic_review, false);
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

test("open-batches trigger-contact refuses unaudited selection input", () => {
  const stateDir = fs.mkdtempSync(path.join(STATE_DIR, "test_contact_audit_"));
  const env = { ...process.env, JOB_BOARD_HARNESS_STATE_DIR: stateDir };
  const input = path.join(stateDir, "manual_selection.json");
  const queueFile = path.join(stateDir, "queue.json");
  fs.writeFileSync(
    input,
    `${JSON.stringify(
      {
        selected: [
          {
            id: "manual-no-review",
            site: "boss",
            title: "金融量化编程师 Python Pine",
            url: "https://www.zhipin.com/job_detail/manual.html?securityId=sec",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const failed = spawnSync(process.execPath, [
    HARNESS,
    "open-batches",
    "--input",
    input,
    "--queue",
    queueFile,
    "--trigger-contact",
    "--dry-run",
    "--allow-previous",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env,
  });

  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /unaudited contact input/i);
  assert.equal(fs.existsSync(queueFile), false);
});

test("open-batches trigger-contact refuses rule-fallback review selections", () => {
  const stateDir = fs.mkdtempSync(path.join(STATE_DIR, "test_contact_rule_fallback_"));
  const env = { ...process.env, JOB_BOARD_HARNESS_STATE_DIR: stateDir };
  const input = path.join(stateDir, "rule_fallback_selection.json");
  const queueFile = path.join(stateDir, "queue.json");
  fs.writeFileSync(
    input,
    `${JSON.stringify(
      {
        selected: [
          {
            id: "rule-fallback-selected",
            site: "boss",
            title: "AI Agent Engineer",
            url: "https://www.zhipin.com/job_detail/rule-fallback.html?securityId=sec",
            score: 80,
            semantic_review: false,
            review_mode: "rule_fallback",
            review: {
              decision: "select",
              confidence: "high",
              reason: "Keyword score selected this record.",
              risk: "Not semantically reviewed.",
            },
            explain: {
              matched: [{ term: "AI Agent", weight: 36, field: "title" }],
              negative: [],
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

  const failed = spawnSync(process.execPath, [
    HARNESS,
    "open-batches",
    "--input",
    input,
    "--queue",
    queueFile,
    "--trigger-contact",
    "--dry-run",
    "--allow-previous",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env,
  });

  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /semantic agent review/i);
  assert.equal(fs.existsSync(queueFile), false);
});

test("semantic agent review output survives select and can dry-run trigger-contact", () => {
  const stateDir = fs.mkdtempSync(path.join(STATE_DIR, "test_contact_semantic_"));
  const env = { ...process.env, JOB_BOARD_HARNESS_STATE_DIR: stateDir };
  const rankedFile = path.join(stateDir, "ranked.json");
  const modelReviewFile = path.join(stateDir, "model_review.json");
  const reviewFile = path.join(stateDir, "agent_review.json");
  const selectionFile = path.join(stateDir, "selection.json");
  const queueFile = path.join(stateDir, "queue.json");
  const candidate = {
    id: "semantic-selected",
    site: "boss",
    title: "AI Agent Engineer",
    company: "Future AI",
    url: "https://www.zhipin.com/job_detail/semantic-selected.html?securityId=sec",
    score: 86,
    explain: {
      matched: [{ term: "AI Agent", weight: 36, field: "title" }],
      negative: [],
      hard_filters: [],
    },
  };

  fs.writeFileSync(rankedFile, `${JSON.stringify({ ranked: [candidate] }, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    modelReviewFile,
    `${JSON.stringify(
      {
        review_mode: "semantic_job_fit",
        semantic_review: true,
        selection: [
          {
            id: "semantic-selected",
            decision: "select",
            confidence: "high",
            semantic_fit: "strong",
            fit_summary: "AI Agent engineering is the core role scope.",
            reason: "The job title and card evidence both center on AI Agent delivery.",
            risk: "Need detail-page confirmation before any non-default message.",
            matched_evidence: ["AI Agent"],
            evidence_quotes: ["AI Agent Engineer"],
            risk_flags: [],
            candidate,
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
    "--review-output",
    modelReviewFile,
    "--out",
    reviewFile,
  ], { env }));
  assert.equal(reviewSummary.mode, "validate");

  const selectSummary = JSON.parse(runHarness([
    "select",
    "--review",
    reviewFile,
    "--out",
    selectionFile,
  ], { env }));
  assert.equal(selectSummary.selected_count, 1);
  const selection = JSON.parse(fs.readFileSync(selectionFile, "utf8"));
  assert.equal(selection.meta.review_mode, "semantic_job_fit");
  assert.equal(selection.meta.semantic_review, true);
  assert.equal(selection.selected[0].semantic_review, true);
  assert.equal(selection.selected[0].review.semantic_fit, "strong");
  assert.deepEqual(selection.selected[0].review.evidence_quotes, ["AI Agent Engineer"]);

  const dryRun = JSON.parse(runHarness([
    "open-batches",
    "--input",
    selectionFile,
    "--queue",
    queueFile,
    "--trigger-contact",
    "--dry-run",
    "--allow-previous",
  ], { env }));
  assert.equal(dryRun.dry_run, true);
  assert.equal(dryRun.queue.remaining, 1);
});

test("select drops duplicate and previously opened semantic jobs", () => {
  const stateDir = fs.mkdtempSync(path.join(STATE_DIR, "test_select_dedupe_"));
  const reviewFile = path.join(stateDir, "review.json");
  const selectionFile = path.join(stateDir, "selection.json");
  fs.writeFileSync(path.join(stateDir, "opened_keys.txt"), "sig:platform sre|cloud co|shanghai\n", "utf8");
  fs.writeFileSync(
    reviewFile,
    `${JSON.stringify(
      {
        reviewed_at: "2026-05-15T00:00:00.000Z",
        profile: "ai-agent-dev",
        selection: [
          {
            id: "boss-ai-agent",
            decision: "select",
            confidence: "high",
            reason: "strong match",
            risk: "none",
            candidate: {
              id: "boss-ai-agent",
              site: "boss",
              title: "Senior AI Agent Engineer",
              company: "Future AI",
              location: "Shenzhen",
              url: "https://www.zhipin.com/job_detail/first-account-id.html?securityId=sec",
              score: 82,
            },
          },
          {
            id: "liepin-ai-agent",
            decision: "select",
            confidence: "high",
            reason: "same job from another site",
            risk: "none",
            candidate: {
              id: "liepin-ai-agent",
              site: "liepin",
              title: "Senior AI Agent Engineer",
              company: "Future AI",
              location: "Shenzhen",
              url: "https://www.liepin.com/job/1981404999.shtml",
              score: 80,
            },
          },
          {
            id: "previously-opened",
            decision: "select",
            confidence: "high",
            reason: "already reviewed in an earlier run",
            risk: "none",
            candidate: {
              id: "previously-opened",
              site: "boss",
              title: "Platform SRE",
              company: "Cloud Co",
              location: "Shanghai",
              url: "https://www.zhipin.com/job_detail/previously-opened.html",
              score: 76,
            },
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const output = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "select",
    "--review",
    reviewFile,
    "--out",
    selectionFile,
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, JOB_BOARD_HARNESS_STATE_DIR: stateDir },
  }));

  assert.equal(output.selected_count, 1);
  assert.equal(output.rejected_count, 2);
  const selection = JSON.parse(fs.readFileSync(selectionFile, "utf8"));
  assert.deepEqual(selection.selected.map((item) => item.id), ["boss-ai-agent"]);
  assert.deepEqual(selection.rejected.map((item) => item.skipReason), [
    "duplicate-job-signature",
    "already-opened",
  ]);
});

test("open-batches dry-run skips semantic jobs opened in earlier runs", () => {
  const stateDir = fs.mkdtempSync(path.join(STATE_DIR, "test_open_batches_semantic_"));
  const input = path.join(stateDir, "selection.json");
  const queueFile = path.join(stateDir, "queue.json");
  fs.writeFileSync(path.join(stateDir, "opened_keys.txt"), "sig:senior ai agent engineer|future ai|shenzhen\n", "utf8");
  fs.writeFileSync(
    input,
    `${JSON.stringify(
      {
        selected: [
          {
            id: "same-job-new-account-url",
            site: "boss",
            title: "Senior AI Agent Engineer",
            company: "Future AI",
            location: "Shenzhen",
            url: "https://www.zhipin.com/job_detail/second-account-id.html?securityId=sec",
          },
          {
            id: "new-job",
            site: "liepin",
            title: "Runtime Systems Engineer",
            company: "Kernel Co",
            location: "Beijing",
            url: "https://www.liepin.com/job/1981405000.shtml",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const output = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "open-batches",
    "--input",
    input,
    "--queue",
    queueFile,
    "--max-per-batch",
    "15",
    "--dry-run",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, JOB_BOARD_HARNESS_STATE_DIR: stateDir },
  }));

  assert.equal(output.queue.total, 1);
  assert.equal(output.queue.items[0].record.id, "new-job");
  assert.deepEqual(output.rejected.map((item) => item.skipReason), ["already-opened"]);
});

test("open-batches resume rechecks pending queue items against opened state", () => {
  const stateDir = fs.mkdtempSync(path.join(STATE_DIR, "test_open_batches_resume_"));
  const queueFile = path.join(stateDir, "queue.json");
  fs.writeFileSync(path.join(stateDir, "opened_keys.txt"), "sig:senior ai agent engineer|future ai|shenzhen\n", "utf8");
  fs.writeFileSync(
    queueFile,
    `${JSON.stringify(
      {
        queue_id: "resume-test",
        status: "pending",
        reason: "",
        created_at: "2026-05-15T00:00:00.000Z",
        updated_at: "2026-05-15T00:00:00.000Z",
        max_per_batch: 15,
        cooldown_ms: 0,
        jitter_ms: 0,
        stop_on_access_limited: true,
        cursor: 0,
        total: 2,
        opened: 0,
        failed: 0,
        remaining: 2,
        items: [
          {
            index: 0,
            status: "pending",
            opened_at: null,
            error: null,
            record: {
              id: "already-opened",
              site: "boss",
              title: "Senior AI Agent Engineer",
              company: "Future AI",
              location: "Shenzhen",
              url: "https://www.zhipin.com/job_detail/resume-duplicate.html",
            },
          },
          {
            index: 1,
            status: "pending",
            opened_at: null,
            error: null,
            record: {
              id: "new-resume-job",
              site: "liepin",
              title: "Runtime Systems Engineer",
              company: "Kernel Co",
              location: "Beijing",
              url: "https://www.liepin.com/job/1981405001.shtml",
            },
          },
        ],
        receipts: [],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const output = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "open-batches",
    "--resume",
    "--queue",
    queueFile,
    "--dry-run",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, JOB_BOARD_HARNESS_STATE_DIR: stateDir },
  }));

  assert.equal(output.queue.remaining, 1);
  assert.equal(output.queue.items[0].status, "opened");
  assert.deepEqual(output.rejected.map((item) => item.skipReason), ["already-opened"]);
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
