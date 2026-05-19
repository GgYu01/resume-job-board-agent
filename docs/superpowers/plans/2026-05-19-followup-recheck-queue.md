# Follow-Up Recheck Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist BOSS/Liepin follow-up exchange actions that are blocked by platform state and retry them safely across later runs, including replies that arrive days later.

**Architecture:** Add a durable follow-up recheck queue under the harness state directory. Initial contact/follow-up runs upsert entries when resume/WeChat exchange actions are unavailable, and a new `followup-recheck` command reopens pending conversations, verifies identity, retries only the missing exchange actions by default, and updates queue status from current page evidence. The queue stores IDs, URLs, action state, timestamps, attempts, receipt paths, and hashed message-plan metadata, but never stores cookies, credentials, or full personal message bodies.

**Tech Stack:** Node.js ESM, existing CDP harness, `node --test`, current `src/cli/runtime-legacy.mjs` command dispatcher, JSON state files under `.tmp/job_board_harness`.

---

## Design Decisions

- Do not wait in a long-running process for HR replies. Replies can arrive hours or days later, so long waits are brittle and hide state.
- Do not infer readiness from unread counters alone. Recheck opens the specific detail/chat path and treats the current exchange button state as the source of truth.
- Do not resend the long follow-up message during recheck by default. The initial run already sends/verifies it; recheck retries only missing resume/WeChat exchange actions unless a future explicit option changes that.
- Preserve reviewability. Every pending and rechecked entry must include `lastReason`, `lastEvidence`, `attemptCount`, `lastCheckedAt`, and `lastReceipt`.
- Preserve safety. Queue records must not contain raw cookies, browser state, phone numbers, WeChat IDs, or full personal message bodies.

## Files

- Create: `src/sites/contact-followup-recheck.mjs`
  - Pure queue helpers for extracting pending entries from contact receipts, merging queue records, aging/selection, and applying recheck results.
- Modify: `src/cli/runtime-legacy.mjs`
  - Write queue entries after `open` and `open-batches` contact follow-up runs.
  - Add `followup-recheck` command.
  - Add summary counters and help text.
- Modify: `src/cli/main.ts`
  - Add `followup-recheck` to the legacy command set.
- Create: `test/unit/contact-followup-recheck.test.mjs`
  - Unit tests for queue upsert, dedupe, status transitions, no message-body persistence, and dry-run selection.
- Modify: `test/unit/job-board-architecture-cli.test.mjs` or `tools/job_board_harness.test.mjs`
  - Add CLI dry-run/help coverage for `followup-recheck`.
- Modify: `docs/job-board-ai-workflow.md`
  - Document two-phase follow-up behavior and operational commands.
- Modify: `docs/privacy-and-guardrails.md`
  - Document queue persistence boundaries.

## Queue Schema

Each queue file is JSON:

```json
{
  "schema": "job-board-followup-recheck/v1",
  "createdAt": "2026-05-19T00:00:00.000Z",
  "updatedAt": "2026-05-19T00:00:00.000Z",
  "items": [
    {
      "key": "boss:8a80bea5be74ad660nB429S1ElNR",
      "site": "boss",
      "id": "8a80bea5be74ad660nB429S1ElNR",
      "canonical_id": "8a80bea5be74ad660nB429S1ElNR",
      "url": "https://www.zhipin.com/job_detail/8a80bea5be74ad660nB429S1ElNR.html",
      "title": "Software Engineer",
      "company": "Example Company",
      "recruiter": "Example HR",
      "pendingActions": ["resume", "wechat"],
      "status": "pending",
      "reason": "platform-requires-mutual-reply",
      "createdAt": "2026-05-19T00:00:00.000Z",
      "updatedAt": "2026-05-19T00:00:00.000Z",
      "lastUnavailableAt": "2026-05-19T00:00:00.000Z",
      "nextCheckAt": "2026-05-19T12:00:00.000Z",
      "attemptCount": 0,
      "lastReceipt": ".tmp/job_board_harness/opened.json",
      "lastEvidence": {
        "resume": "send resume unavailable until both sides reply",
        "wechat": "wechat exchange unavailable until both sides reply"
      },
      "messagePlan": {
        "normalizedCount": 2,
        "totalChars": 965,
        "messages": [
          { "index": 0, "role": "resume-note", "length": 23, "sha256": "..." }
        ]
      }
    }
  ],
  "history": []
}
```

## Task 1: Pure Queue State

**Files:**
- Create: `src/sites/contact-followup-recheck.mjs`
- Create: `test/unit/contact-followup-recheck.test.mjs`

- [ ] **Step 1: Write failing tests for pending entry extraction**

```js
test("extractFollowupRecheckEntries stores blocked BOSS exchange actions without message bodies", () => {
  const entries = extractFollowupRecheckEntries([contactActionWithPlatformUnavailableFollowup], {
    receiptPath: ".tmp/job_board_harness/live.json",
    now: "2026-05-19T00:00:00.000Z",
  });
  assert.deepEqual(entries[0].pendingActions, ["resume", "wechat"]);
  assert.equal(entries[0].reason, "platform-requires-mutual-reply");
  assert.equal(JSON.stringify(entries).includes("base Hefei personal message"), false);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/unit/contact-followup-recheck.test.mjs`

Expected: FAIL because `src/sites/contact-followup-recheck.mjs` does not exist.

- [ ] **Step 3: Implement extraction and queue upsert**

Implement:

```js
export function extractFollowupRecheckEntries(contactActions, { receiptPath = "", now = new Date().toISOString() } = {}) { ... }
export function upsertFollowupRecheckQueue(queue, entries, { now = new Date().toISOString(), retryAfterHours = 12 } = {}) { ... }
export function summarizeFollowupRecheckQueue(queue) { ... }
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/unit/contact-followup-recheck.test.mjs`

Expected: PASS for extraction, dedupe, and no-message-body assertions.

## Task 2: Recheck Result State Transitions

**Files:**
- Modify: `src/sites/contact-followup-recheck.mjs`
- Modify: `test/unit/contact-followup-recheck.test.mjs`

- [ ] **Step 1: Write failing tests for result application**

```js
test("applyFollowupRecheckResults marks entries complete when blocked actions are now satisfied", () => {
  const next = applyFollowupRecheckResults(queueWithPendingItem, [successfulRecheckAction], {
    now: "2026-05-20T00:00:00.000Z",
  });
  assert.equal(next.items[0].status, "completed");
  assert.deepEqual(next.items[0].completedActions.sort(), ["resume", "wechat"]);
});
```

Also cover:

- still unavailable -> remains `pending`, increments `attemptCount`, moves `nextCheckAt`.
- rejected conversation -> status `rejected`.
- identity mismatch or failed verification -> status remains `pending` with `lastError`.

- [ ] **Step 2: Verify RED**

Run: `node --test test/unit/contact-followup-recheck.test.mjs`

Expected: FAIL because `applyFollowupRecheckResults` is missing.

- [ ] **Step 3: Implement transitions**

Implement:

```js
export function applyFollowupRecheckResults(queue, contactActions, { now = new Date().toISOString(), retryAfterHours = 12 } = {}) { ... }
export function selectDueFollowupRechecks(queue, { now = new Date().toISOString(), max = 10, includeNotDue = false } = {}) { ... }
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/unit/contact-followup-recheck.test.mjs`

Expected: PASS.

## Task 3: Persist Queue From Contact Runs

**Files:**
- Modify: `src/cli/runtime-legacy.mjs`
- Modify: `test/unit/contact-followup-recheck.test.mjs`

- [ ] **Step 1: Write failing tests for receipt-to-queue persistence helper**

```js
test("recordFollowupRecheckQueueFromContactActions upserts blocked actions and returns summary", () => {
  const result = recordFollowupRecheckQueueFromContactActions(existingQueue, contactActions, {
    receiptPath: ".tmp/job_board_harness/opened.json",
    now: "2026-05-19T00:00:00.000Z",
  });
  assert.equal(result.summary.pending, 1);
  assert.equal(result.queue.items[0].lastReceipt, ".tmp/job_board_harness/opened.json");
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/unit/contact-followup-recheck.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Integrate runtime persistence**

After `open` or `open-batches` writes receipts, call the queue helper when any contact action has `followup.unavailableExchangeCount > 0`.

Default queue file:

```text
.tmp/job_board_harness/followup_recheck_queue.json
```

Add options:

```text
--followup-recheck-queue <file>
--no-followup-recheck-queue
--followup-recheck-after-hours <n>
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --test test/unit/contact-followup-recheck.test.mjs
npm run verify
```

Expected: PASS.

## Task 4: `followup-recheck` Command

**Files:**
- Modify: `src/cli/runtime-legacy.mjs`
- Modify: `src/cli/main.ts`
- Modify: `tools/job_board_harness.test.mjs`

- [ ] **Step 1: Write failing CLI dry-run test**

```js
test("followup-recheck dry-run reports due pending queue entries", () => {
  const output = execFileSync(node, [
    harness,
    "followup-recheck",
    "--queue",
    queueFile,
    "--dry-run",
    "--max",
    "5",
  ], { encoding: "utf8" });
  const parsed = JSON.parse(output);
  assert.equal(parsed.dry_run, true);
  assert.equal(parsed.pending_count, 1);
  assert.equal(parsed.next_count, 1);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tools/job_board_harness.test.mjs`

Expected: FAIL with unknown command.

- [ ] **Step 3: Implement command**

Command behavior:

```text
node tools/job_board_harness.mjs followup-recheck --queue .tmp/job_board_harness/followup_recheck_queue.json --max 10 --followup-step-delay-ms 1200 --followup-verify-delay-ms 3000
```

Dry-run:

- load queue
- select due pending entries
- print queue summary and next entries
- no CDP mutation

Live:

- auth gate for involved sites
- open detail pages for due entries
- trigger/verify correct conversation with existing identity matching
- run follow-up with only the pending exchange actions and empty message list by default
- update queue from the returned `followup` result
- write receipt to `.tmp/job_board_harness/followup_recheck_<timestamp>.json`

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm run build
node --test tools/job_board_harness.test.mjs test/unit/contact-followup-recheck.test.mjs
```

Expected: PASS.

## Task 5: Documentation And Live Smoke

**Files:**
- Modify: `docs/job-board-ai-workflow.md`
- Modify: `docs/privacy-and-guardrails.md`

- [ ] **Step 1: Document the operational model**

Document:

- initial run records platform-unavailable actions to queue.
- recheck can run hours/days later.
- readiness is determined by current button availability, not by waiting.
- no raw personal message body is stored.
- default recheck does not resend long messages.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run build
npm run verify
```

Expected: 0 failures.

- [ ] **Step 3: Run local write-path smoke**

Use a fixture queue and `followup-recheck --dry-run`, then verify output JSON and queue file are written under `.tmp/job_board_harness`.

- [ ] **Step 4: Run real CDP smoke**

Run a real BOSS recheck against the current queue or a known BOSS blocked item with `--max 1 --keep-contact-pages`. Expected outcomes:

- if still blocked: `status: pending`, `reason: platform-requires-mutual-reply`, no false click.
- if now available: exchange action is clicked and queue item becomes `completed`.
- if rejected: queue item becomes `rejected`.

## Self-Review

- Spec coverage: The plan handles delayed HR replies, multiple later runs, preserving the evidence trail, avoiding duplicate long messages, and knowing which conversations to revisit through a durable queue.
- Placeholder scan: No task relies on TBD behavior; each task defines files, commands, and expected outcomes.
- Type consistency: Queue item field names are consistent across extraction, persistence, command output, and docs.
