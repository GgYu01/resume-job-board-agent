# Job Quality Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent low-fit jobs such as 普工、销售、金融、陪玩、测试助理、文员 from entering contact-trigger batches, while preserving enough evidence for later independent review and self-repair.

**Architecture:** Keep live browser operations deterministic and local, but add stronger gates before external actions. `collect` must only inspect intended search/list targets unless recommendation collection is explicitly requested; `rank` must record hard-filter evidence; `open`/`open-batches --trigger-contact` must refuse unaudited input unless explicitly overridden.

**2026-05-17 semantic review supersession:** The profile-specific keyword hard
gate portion of this plan was replaced by a semantic-review production gate.
`ai-agent-dev` no longer uses `hard_filters.required_any_terms` or
`hard_filters.reject_terms` as final role-family gates. `rank` remains
retrieval/evidence, while `--trigger-contact --input` requires validated
`agent-review --review-output` records with semantic fit and evidence quotes.

**2026-05-17 recommendation source update:** BOSS `/web/geek/jobs` without a
query and Liepin `/zhaopin/` without a keyword are treated as first-party
recommendation-list pages. Use `collect --include-recommendation-pages` or the
default `run --profile ...` pipeline to include them as an audited source with
`collectionReason: "recommendation-list-tab"`. Detail-page recommendation
sections remain opt-in through `--include-recommendations`.

**Tech Stack:** Node.js ESM, TypeScript CLI seam, YAML role profiles, `node:test`, Edge Beta CDP harness.

---

### Task 1: Collect Target Isolation

**Files:**
- Modify: `src/cli/runtime-legacy.mjs`
- Test: `test/unit/job-board-architecture-cli.test.mjs`

- [x] **Step 1: Add failing tests**

Add tests that prove seeded collection no longer includes unrelated same-host tabs and default collection skips detail-page recommendation tabs.

- [x] **Step 2: Implement target classification**

Add helpers that classify targets as `seeded-url`, `search-list-tab`,
`recommendation-list-tab`, `detail-recommendations`, `all-tabs`, or skipped
with a reason. With `--url`, collect only the created target ids, exact seed
URLs, and explicitly opened recommendation-list pages. Without `--url`, collect
search/list and first-party recommendation-list pages. Add
`--include-recommendations` as an explicit opt-in for detail-page
recommendation scraping.

- [x] **Step 3: Record evidence**

Write `meta.pages[].collectionReason` and `meta.skippedTargets[]` into candidates artifacts so later audits can explain where each candidate came from.

### Task 2: Generic Hard Filter Support (Superseded For `ai-agent-dev`)

**Files:**
- Modify: `src/rank/keyword-ranker.mjs`
- Modify: `src/config/load-config.mjs`
- Modify: `configs/roles/ai-agent-dev.yaml`
- Test: `test/unit/ranking-golden.test.mjs`
- Test: `test/unit/config-validation.test.mjs`

- [x] **Step 1: Add failing tests**

Historical step: add fixtures for hard-filter behavior. This no longer means
`ai-agent-dev` should hard-reject role families by keyword.

- [x] **Step 2: Implement profile hard filters**

Keep generic support for `hard_filters.reject_terms` and
`hard_filters.required_any_terms` for profiles that explicitly need objective
string gates. `ai-agent-dev` does not use them as final fit criteria.

- [x] **Step 3: Harden AI Agent profile**

Superseded: remove profile-specific role-family hard gates from
`configs/roles/ai-agent-dev.yaml` and rely on semantic review before contact.

### Task 3: Contact Audit Gate

**Files:**
- Modify: `src/cli/runtime-legacy.mjs`
- Test: `test/unit/job-board-architecture-cli.test.mjs`

- [x] **Step 1: Add failing tests**

Add dry-run tests where `open-batches --trigger-contact --input` refuses
manual selections and rule-fallback selections without validated semantic
review evidence.

- [x] **Step 2: Implement guard**

When `--trigger-contact` is used with `--input`, require selected records to
include validated semantic review decision evidence and rank evidence. Direct
`--url` remains allowed because it is an explicit single-target user action.
Add `--allow-unaudited-contact` as an explicit override.

### Task 4: Evidence Reports And Docs

**Files:**
- Modify: `src/cli/runtime-legacy.mjs`
- Modify: `docs/job-board-ai-workflow.md`
- Modify: `docs/codex-local-tooling.md`

- [x] **Step 1: Improve rank reports**

Include hard-filter reason samples in `.md` reports and keep JSON evidence complete.

- [x] **Step 2: Document current search logic**

Document that normal collection is search/list/recommendation-list only,
detail-page recommendations require `--include-recommendations`, and
model/Codex semantic review should use `agent-review --prepare` /
`--review-output` before contact-trigger batches.

### Verification

- [x] `node --test test/unit/ranking-golden.test.mjs`
- [x] `node --test test/unit/config-validation.test.mjs`
- [x] `node --test test/unit/job-board-architecture-cli.test.mjs`
- [x] `npm run build`
- [x] `npm run verify`
- [x] Fixture dry-run with `boss-search-normal`
- [x] Real Edge CDP dry-run collect/rank/review/select/open-batches without triggering contact
