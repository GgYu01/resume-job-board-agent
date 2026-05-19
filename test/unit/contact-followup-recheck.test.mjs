import assert from "node:assert/strict";
import test from "node:test";

import {
  applyFollowupRecheckResults,
  extractFollowupRecheckEntries,
  recordFollowupRecheckQueueFromContactActions,
  selectDueFollowupRechecks,
  summarizeFollowupRecheckQueue,
  upsertFollowupRecheckQueue,
} from "../../src/sites/contact-followup-recheck.mjs";

const NOW = "2026-05-19T00:00:00.000Z";

function blockedContactAction(overrides = {}) {
  return {
    site: "boss",
    id: "boss-llm-1",
    canonical_id: "boss-llm-1",
    url: "https://www.zhipin.com/job_detail/boss-llm-1.html",
    title: "Software Engineer LLM",
    company: "Example AI",
    verification: {
      expectedConversation: {
        jobTitle: "Software Engineer LLM",
        recruiter: "Ms Liu",
        company: "Example AI",
      },
    },
    followup: {
      enabled: true,
      attempted: true,
      verified: true,
      status: "followup-sent",
      unavailableExchangeCount: 2,
      actions: [
        {
          type: "resume",
          status: "platform-unavailable",
          unavailable: true,
          reason: "platform-requires-mutual-reply",
          targetText: "send resume unavailable until both sides reply",
        },
        {
          type: "wechat",
          status: "platform-unavailable",
          unavailable: true,
          reason: "platform-requires-mutual-reply",
          targetText: "wechat unavailable until both sides reply",
        },
      ],
      sentMessages: [
        {
          index: 0,
          status: "sent",
          verified: true,
          snippet: "base Hefei personal message",
        },
      ],
      messagePlan: {
        normalizedCount: 2,
        totalChars: 965,
        messages: [
          { index: 0, role: "resume-note", length: 23, sha256: "hash-note" },
          { index: 1, role: "followup-message", length: 942, sha256: "hash-main" },
        ],
        sources: { file: ".tmp/job_board_harness/followup_message_live.txt" },
      },
    },
    ...overrides,
  };
}

test("extractFollowupRecheckEntries stores blocked exchange actions without message bodies", () => {
  const entries = extractFollowupRecheckEntries([blockedContactAction()], {
    receiptPath: ".tmp/job_board_harness/live.json",
    now: NOW,
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "boss:boss-llm-1");
  assert.deepEqual(entries[0].pendingActions, ["resume", "wechat"]);
  assert.equal(entries[0].reason, "platform-requires-mutual-reply");
  assert.equal(entries[0].lastReceipt, ".tmp/job_board_harness/live.json");
  assert.deepEqual(entries[0].lastEvidence, {
    resume: "send resume unavailable until both sides reply",
    wechat: "wechat unavailable until both sides reply",
  });
  assert.equal(entries[0].messagePlan.normalizedCount, 2);
  assert.equal(JSON.stringify(entries).includes("base Hefei personal message"), false);
});

test("upsertFollowupRecheckQueue dedupes by site and canonical id while preserving attempts", () => {
  const initial = upsertFollowupRecheckQueue(null, extractFollowupRecheckEntries([blockedContactAction()], { now: NOW }), {
    now: NOW,
    retryAfterHours: 12,
  });
  const retried = {
    ...initial.items[0],
    attemptCount: 3,
    lastCheckedAt: "2026-05-20T00:00:00.000Z",
  };
  const next = upsertFollowupRecheckQueue({ ...initial, items: [retried] }, extractFollowupRecheckEntries([
    blockedContactAction({
      followup: {
        ...blockedContactAction().followup,
        actions: [blockedContactAction().followup.actions[1]],
        unavailableExchangeCount: 1,
      },
    }),
  ], { now: "2026-05-21T00:00:00.000Z" }), {
    now: "2026-05-21T00:00:00.000Z",
    retryAfterHours: 24,
  });

  assert.equal(next.items.length, 1);
  assert.equal(next.items[0].attemptCount, 3);
  assert.deepEqual(next.items[0].pendingActions, ["resume", "wechat"]);
  assert.equal(next.items[0].updatedAt, "2026-05-21T00:00:00.000Z");
  assert.equal(next.items[0].nextCheckAt, "2026-05-22T00:00:00.000Z");
});

test("selectDueFollowupRechecks returns due pending entries and skips completed items", () => {
  const queue = {
    schema: "job-board-followup-recheck/v1",
    items: [
      { key: "boss:due", status: "pending", nextCheckAt: "2026-05-18T00:00:00.000Z" },
      { key: "boss:not-due", status: "pending", nextCheckAt: "2026-05-20T00:00:00.000Z" },
      { key: "boss:done", status: "completed", nextCheckAt: "2026-05-18T00:00:00.000Z" },
    ],
  };

  assert.deepEqual(selectDueFollowupRechecks(queue, { now: NOW, max: 10 }).map((item) => item.key), ["boss:due"]);
  assert.deepEqual(selectDueFollowupRechecks(queue, { now: NOW, max: 10, includeNotDue: true }).map((item) => item.key), ["boss:due", "boss:not-due"]);
});

test("applyFollowupRecheckResults marks unavailable entries completed after exchange success", () => {
  const queue = upsertFollowupRecheckQueue(null, extractFollowupRecheckEntries([blockedContactAction()], { now: NOW }), { now: NOW });
  const next = applyFollowupRecheckResults(queue, [
    {
      ...blockedContactAction(),
      followup: {
        enabled: true,
        attempted: true,
        verified: true,
        status: "followup-sent",
        unavailableExchangeCount: 0,
        clickedExchangeCount: 2,
        actions: [
          { type: "resume", status: "clicked", clicked: true, satisfied: true },
          { type: "wechat", status: "clicked", clicked: true, satisfied: true },
        ],
      },
    },
  ], { now: "2026-05-20T00:00:00.000Z" });

  assert.equal(next.items[0].status, "completed");
  assert.deepEqual(next.items[0].completedActions.sort(), ["resume", "wechat"]);
  assert.equal(next.items[0].lastCheckedAt, "2026-05-20T00:00:00.000Z");
  assert.equal(summarizeFollowupRecheckQueue(next).completed, 1);
});

test("applyFollowupRecheckResults keeps still-blocked entries pending with next check time", () => {
  const queue = upsertFollowupRecheckQueue(null, extractFollowupRecheckEntries([blockedContactAction()], { now: NOW }), { now: NOW });
  const next = applyFollowupRecheckResults(queue, [blockedContactAction()], {
    now: "2026-05-20T00:00:00.000Z",
    retryAfterHours: 48,
  });

  assert.equal(next.items[0].status, "pending");
  assert.equal(next.items[0].attemptCount, 1);
  assert.equal(next.items[0].nextCheckAt, "2026-05-22T00:00:00.000Z");
  assert.equal(next.items[0].lastUnavailableAt, "2026-05-20T00:00:00.000Z");
});

test("applyFollowupRecheckResults marks rejected conversations terminal", () => {
  const queue = upsertFollowupRecheckQueue(null, extractFollowupRecheckEntries([blockedContactAction()], { now: NOW }), { now: NOW });
  const next = applyFollowupRecheckResults(queue, [
    {
      ...blockedContactAction(),
      followup: {
        enabled: true,
        attempted: true,
        verified: true,
        skipped: true,
        skipReason: "conversation-rejected",
        status: "followup-skipped-rejected",
        actions: [],
      },
    },
  ], { now: "2026-05-20T00:00:00.000Z" });

  assert.equal(next.items[0].status, "rejected");
  assert.equal(next.items[0].terminalReason, "conversation-rejected");
});

test("recordFollowupRecheckQueueFromContactActions upserts receipt entries and summary", () => {
  const result = recordFollowupRecheckQueueFromContactActions(null, [blockedContactAction()], {
    receiptPath: ".tmp/job_board_harness/opened.json",
    now: NOW,
    retryAfterHours: 6,
  });

  assert.equal(result.entries.length, 1);
  assert.equal(result.summary.pending, 1);
  assert.equal(result.summary.due, 0);
  assert.equal(result.queue.items[0].lastReceipt, ".tmp/job_board_harness/opened.json");
  assert.equal(result.queue.items[0].nextCheckAt, "2026-05-19T06:00:00.000Z");
});
