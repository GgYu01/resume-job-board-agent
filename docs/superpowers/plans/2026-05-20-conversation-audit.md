# Conversation Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe conversation-wide audit command that scans existing BOSS/Liepin chat conversations for resume/WeChat exchange readiness and can explicitly execute only those exchange actions without resending long follow-up messages.

**Architecture:** Keep `followup-recheck` as the precise queue path for known platform-blocked items, and add `conversation-audit` as a broader safety-net scanner. The scanner opens chat pages in the durable Edge Beta CDP profile, extracts visible existing conversation entries, selects each conversation, runs the existing follow-up exchange detector in read-only or explicit execute mode, and writes redacted JSON evidence under `.tmp/job_board_harness/`.

**Tech Stack:** Node.js ESM, TypeScript CLI wrapper, Edge Beta CDP, browser-injected JavaScript expressions, `node:test`.

---

## Design Decisions

- Default mode is read-only audit. `--execute` is required before any resume/WeChat button click.
- The command must never trigger a new job contact from a detail page. It operates on chat/message pages only.
- The command must not send the long in-service/base-Hefei template message. It passes an empty message list to follow-up logic.
- Read-only audit should still detect available, blocked, already-satisfied, and missing exchange actions.
- Execute mode should reuse the existing resume/WeChat exchange flow, including resume modal/default resume selection and confirmation handling.
- Receipts must redact chat text samples and contact values before writing to disk.
- The first implementation scans visible/sidebar conversations with a bounded max. It should not implement infinite scrolling until a separate measured need appears.

## File Structure

- Modify `src/sites/contact-followup.mjs`
  - Add `auditOnly` support to `contactFollowupExpression`.
  - In audit-only mode, available exchange controls are reported but not clicked.
- Create `src/sites/conversation-audit.mjs`
  - Browser expressions for listing and selecting existing chat conversations.
  - Pure helpers for redacting and summarizing audit results.
- Modify `src/cli/runtime-legacy.mjs`
  - Add `cmdConversationAudit`.
  - Add live CDP orchestration, auth gate, chat URL opening, per-conversation scan/execute loop, JSON receipt writing, and console counters.
- Modify `src/cli/main.ts`
  - Route `conversation-audit` through the legacy runtime.
- Modify `tools/job_board_harness.test.mjs`
  - Add CLI help coverage.
  - Add optional input/dry-run receipt coverage if the command exposes offline summarization.
- Create `test/unit/conversation-audit.test.mjs`
  - Test list extraction, selection click, summary, and redaction.
- Modify `test/unit/contact-followup.test.mjs`
  - Test audit-only available exchange controls do not click.
- Modify `README.md`, `docs/job-board-ai-workflow.md`, and `docs/privacy-and-guardrails.md`
  - Document command purpose, default read-only behavior, `--execute`, and privacy boundary.

## Task 1: Audit-only exchange detection

**Files:**
- Modify: `src/sites/contact-followup.mjs`
- Modify: `test/unit/contact-followup.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a test that builds a fake BOSS active chat with visible `发简历` and `换微信` toolbar controls, runs:

```js
const result = await runBrowserExpression(contactFollowupExpression("boss", {
  messagesNormalized: [],
  auditOnly: true,
  stepDelayMs: 0,
  verifyDelayMs: 0,
}), body, {
  url: "https://www.zhipin.com/web/geek/chat",
  title: "BOSS直聘",
});
```

Assert:

```js
assert.equal(result.status, "followup-audit-read-only");
assert.equal(result.verified, false);
assert.equal(result.clickedExchangeCount, 0);
assert.equal(result.availableExchangeCount, 2);
assert.equal(resume.clicked, 0);
assert.equal(wechat.clicked, 0);
assert.deepEqual(result.actions.map((item) => item.status), ["available", "available"]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/unit/contact-followup.test.mjs`

Expected: FAIL because `auditOnly` is ignored and the buttons are clicked.

- [ ] **Step 3: Implement minimal audit-only support**

In `contactFollowupExpression`, include `auditOnly` in the payload. In `clickExchangeAction`, after unavailable and missing checks and before clicking `selected.target`, return:

```js
if (payload.auditOnly) {
  addTrace("exchange.action.available", {
    type,
    text: clipped(selected.text || selected.targetText, 80),
    targetText: clipped(selected.targetText, 80),
    targetClass: clipped(selected.classes, 140),
  });
  return {
    type,
    clicked: false,
    alreadySatisfied: false,
    satisfied: false,
    available: true,
    status: "available",
    text: selected.text || selected.targetText,
    targetText: selected.targetText,
    targetClass: selected.classes.slice(0, 200),
  };
}
```

Add `availableExchangeCount` to the return payload. Make final status `followup-audit-read-only` when `payload.auditOnly` is true.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/unit/contact-followup.test.mjs`

Expected: PASS.

## Task 2: Conversation list browser expressions and pure summary

**Files:**
- Create: `src/sites/conversation-audit.mjs`
- Create: `test/unit/conversation-audit.test.mjs`

- [ ] **Step 1: Write failing expression tests**

Create tests that evaluate `conversationListExpression("boss", { max: 5 })` against a fake DOM with:

```js
const list = new FakeElement({ className: "chat-list" }).append(
  new FakeElement({ className: "conversation-item active", text: "刘女士\nAI Agent 架构工程师\n昨天 23:18" }),
  new FakeElement({ className: "conversation-item", text: "张先生\n测试开发工程师\n05月18日" }),
);
const toolbar = new FakeElement({ className: "chat-controls" }).append(
  new FakeElement({ tag: "button", className: "toolbar-btn", text: "发简历" }),
);
```

Assert the expression returns two candidates, excludes the toolbar, and each candidate has `auditKey`, `index`, `textSample`, `active`, and `selectorHint`.

Add a second test for `conversationSelectExpression("boss", { auditKey })` that clicks the matching fake conversation item and returns `selected: true`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/unit/conversation-audit.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement browser expressions**

Implement:

```js
export function conversationListExpression(site, { max = 20 } = {}) { ... }
export function conversationSelectExpression(site, { auditKey = "", index = -1 } = {}) { ... }
export function summarizeConversationAuditResults(conversations = []) { ... }
export function sanitizeConversationAuditResult(result = {}) { ... }
```

The list expression should:

- Inspect common sidebar/list selectors.
- Prefer nodes with class names containing `conversation`, `session`, `chat-list`, `friend`, `boss`, or `item`.
- Exclude toolbar/action controls containing `发简历`, `换微信`, `发送`, `输入消息`.
- Return at most `max` unique visible items.

The select expression should:

- Recompute candidates.
- Match by `auditKey` or index.
- Scroll and click the target.
- Return selected candidate text and current URL.

The summary helper should count resume/wechat statuses:

- `available`
- `platform-unavailable`
- `already-satisfied`
- `clicked`
- `action-not-found`

The sanitizer should redact contact values in `textSample`, `targetText`, `text`, `activeConversationSample`, and nested trace samples.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/unit/conversation-audit.test.mjs`

Expected: PASS.

## Task 3: CLI command and dry-run receipt

**Files:**
- Modify: `src/cli/runtime-legacy.mjs`
- Modify: `src/cli/main.ts`
- Modify: `tools/job_board_harness.test.mjs`

- [ ] **Step 1: Write failing CLI tests**

Add help assertion:

```js
assert.match(help, /conversation-audit/);
assert.match(help, /--execute/);
```

If adding offline fixture mode, add:

```js
const output = execFileSync(process.execPath, [
  HARNESS,
  "conversation-audit",
  "--input",
  fixture,
  "--dry-run",
  "--out",
  receipt,
], { cwd: ROOT, encoding: "utf8" });
```

Assert the output writes `receipt`, includes `dry_run: true`, and summarizes available/unavailable counts.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tools/job_board_harness.test.mjs`

Expected: FAIL because `conversation-audit` is not routed or documented.

- [ ] **Step 3: Implement command routing**

Add `"conversation-audit"` to `src/cli/main.ts` legacy commands.

In `runtime-legacy.mjs`, add:

```js
async function cmdConversationAudit(args) { ... }
```

Behavior:

- `--site both|boss|liepin`
- `--max 20`
- `--execute` enables button clicks; default is read-only
- `--url <chat-url>` can seed explicit chat pages
- Default BOSS chat URL: `https://www.zhipin.com/web/geek/chat`
- Default Liepin chat URL: `https://c.liepin.com/`
- Run auth gate unless `--skip-auth-check`
- Open chat pages as background tabs through CDP
- Evaluate `conversationListExpression`
- For each candidate: select conversation, wait, run `contactFollowupExpression(site, { messagesNormalized: [], resumeNote: "", auditOnly: !execute, ... })`
- Sanitize and write receipt
- Print counters:
  - `conversation_count`
  - `audit_read_only`
  - `execute`
  - `available_resume_count`
  - `available_wechat_count`
  - `clicked_resume_count`
  - `clicked_wechat_count`
  - `platform_unavailable_count`
  - `already_satisfied_count`
  - `message_sent_count`

- [ ] **Step 4: Run targeted tests**

Run:

```powershell
node --test tools/job_board_harness.test.mjs test/unit/conversation-audit.test.mjs test/unit/contact-followup.test.mjs
```

Expected: PASS.

## Task 4: Documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/job-board-ai-workflow.md`
- Modify: `docs/privacy-and-guardrails.md`

- [ ] **Step 1: Document operational flow**

Add:

```powershell
.\tools\job-board.cmd conversation-audit --site boss --max 20 --out .tmp\job_board_harness\conversation_audit_boss.json
.\tools\job-board.cmd conversation-audit --site boss --max 20 --execute --out .tmp\job_board_harness\conversation_audit_boss_execute.json
```

Document that default mode is read-only and `--execute` only clicks resume/WeChat exchange controls in existing conversations.

- [ ] **Step 2: Run full automated verification**

Run:

```powershell
npm run build
npm run verify
```

Expected: PASS, all tests green.

- [ ] **Step 3: Run live read-only smoke**

Run:

```powershell
node tools\job_board_harness.mjs auth --site boss --reuse-page --no-open-login
node tools\job_board_harness.mjs conversation-audit --site boss --max 5 --out .tmp\job_board_harness\conversation_audit_boss_readonly.json
```

Expected:

- Auth reports `all_ready: true`.
- Audit writes a receipt.
- `execute: false`.
- `message_sent_count: 0`.
- No `clicked_*` counts in read-only mode.

- [ ] **Step 4: Run live execute smoke if read-only evidence shows safe existing conversations**

Run:

```powershell
node tools\job_board_harness.mjs conversation-audit --site boss --max 1 --execute --out .tmp\job_board_harness\conversation_audit_boss_execute.json
```

Expected:

- It operates only on an existing chat page.
- It sends no long message.
- It records clicked/already-satisfied/unavailable statuses accurately.
- If platform blocks exchange actions, counters show `platform_unavailable_count` and no false success.

## Self-Review

- Spec coverage: This covers the user's request to check all conversations for resume/WeChat readiness, handles delayed HR replies outside the precise queue, avoids duplicate long messages, preserves review evidence, and supports real execution with explicit opt-in.
- Placeholder scan: No placeholders remain; concrete files, commands, and expected outputs are listed.
- Type consistency: The planned exports are consistently named `conversationListExpression`, `conversationSelectExpression`, `summarizeConversationAuditResults`, and `sanitizeConversationAuditResult`.
