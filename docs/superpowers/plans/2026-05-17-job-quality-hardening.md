# Job Quality Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent low-fit jobs such as 普工、销售、金融、陪玩、测试助理、文员 from entering contact-trigger batches, while preserving enough evidence for later independent review and self-repair.

**Architecture:** Keep live browser operations deterministic and local, but add stronger gates before external actions. `collect` must only inspect intended search/list targets unless recommendation collection is explicitly requested; `rank` must record hard-filter evidence; `open`/`open-batches --trigger-contact` must refuse unaudited input unless explicitly overridden.

**Tech Stack:** Node.js ESM, TypeScript CLI seam, YAML role profiles, `node:test`, Edge Beta CDP harness.

---

### Task 1: Collect Target Isolation

**Files:**
- Modify: `src/cli/runtime-legacy.mjs`
- Test: `test/unit/job-board-architecture-cli.test.mjs`

- [x] **Step 1: Add failing tests**

Add tests that prove seeded collection no longer includes unrelated same-host tabs and default collection skips detail-page recommendation tabs.

- [x] **Step 2: Implement target classification**

Add helpers that classify targets as `seeded-url`, `search-list-tab`, `detail-recommendations`, `all-tabs`, or skipped with a reason. With `--url`, collect only the created target ids and exact seed URLs. Without `--url`, collect only search/list pages by default. Add `--include-recommendations` as an explicit opt-in for detail-page recommendation scraping.

- [x] **Step 3: Record evidence**

Write `meta.pages[].collectionReason` and `meta.skippedTargets[]` into candidates artifacts so later audits can explain where each candidate came from.

### Task 2: Profile Hard Gates

**Files:**
- Modify: `src/rank/keyword-ranker.mjs`
- Modify: `src/config/load-config.mjs`
- Modify: `configs/roles/ai-agent-dev.yaml`
- Test: `test/unit/ranking-golden.test.mjs`
- Test: `test/unit/config-validation.test.mjs`

- [x] **Step 1: Add failing tests**

Add fixtures asserting that AI Agent profile hard-rejects low-fit titles even when they contain weak technical keywords.

- [x] **Step 2: Implement profile hard filters**

Support `hard_filters.reject_terms` and `hard_filters.required_any_terms`. Reject terms must create `hard-filter:reject-term:<term>` evidence. Missing required terms must create `hard-filter:missing-required-any:<terms>`.

- [x] **Step 3: Harden AI Agent profile**

Add target evidence terms and obvious low-fit rejection terms to `configs/roles/ai-agent-dev.yaml`.

### Task 3: Contact Audit Gate

**Files:**
- Modify: `src/cli/runtime-legacy.mjs`
- Test: `test/unit/job-board-architecture-cli.test.mjs`

- [x] **Step 1: Add failing tests**

Add a dry-run test where `open-batches --trigger-contact --input manual-selection.json` refuses records without review/score/explain evidence.

- [x] **Step 2: Implement guard**

When `--trigger-contact` is used with `--input`, require selected records to include review decision evidence and rank evidence. Direct `--url` remains allowed because it is an explicit single-target user action. Add `--allow-unaudited-contact` as an explicit override.

### Task 4: Evidence Reports And Docs

**Files:**
- Modify: `src/cli/runtime-legacy.mjs`
- Modify: `docs/job-board-ai-workflow.md`
- Modify: `docs/codex-local-tooling.md`

- [x] **Step 1: Improve rank reports**

Include hard-filter reason samples in `.md` reports and keep JSON evidence complete.

- [x] **Step 2: Document current search logic**

Document that normal collection is search/list-only, recommendations require `--include-recommendations`, and model/Codex semantic review should use `agent-review --prepare` / `--review-output` before contact-trigger batches.

### Verification

- [x] `node --test test/unit/ranking-golden.test.mjs`
- [x] `node --test test/unit/config-validation.test.mjs`
- [x] `node --test test/unit/job-board-architecture-cli.test.mjs`
- [x] `npm run build`
- [x] `npm run verify`
- [x] Fixture dry-run with `boss-search-normal`
- [x] Real Edge CDP dry-run collect/rank/review/select/open-batches without triggering contact
