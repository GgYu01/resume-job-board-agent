# Architecture

Last reviewed: 2026-05-15

## Direction

This project is a local job-board screening tool. The durable architecture is:

- Harness does deterministic actions: browser/CDP, auth gates, collection, URL canonicalization, ranking, batch queues, receipts, and local artifacts.
- Codex agent does judgment: profile drafting, candidate review, false-positive analysis, config suggestions, and user-facing reasoning.
- The final user surface stays simple: selected job detail pages opened in the logged-in browser profile. JSON and Markdown files are audit artifacts, not a dashboard.

## Current Layout

```text
tools/
  job-board.cmd
  job-board.ps1
  job_board_harness.mjs

src/
  agent/prompt-contracts.mjs
  agent/review-runner.mjs
  batch/queue.mjs
  cdp/mock-cdp.mjs
  config/defaults.mjs
  config/browser-config.mjs
  config/load-config.mjs
  config/profile-patch.mjs
  config/simple-yaml.mjs
  extract/collect-links.mjs
  extract/extract-detail.mjs
  metrics/regression.mjs
  privacy/redact.mjs
  rank/keyword-ranker.mjs
  shared/text.mjs
  sites/boss.mjs
  sites/index.mjs
  sites/job51.mjs
  sites/liepin.mjs
  sites/registry.mjs

configs/
  browser.yaml
  roles/*.yaml
  batch.yaml

skills/
  job-board-page-opener/
  job-keyword-profile-review/
  job-selection-review/
  job-feedback-update/
```

`tools/job_board_harness.mjs` is now a small compatibility entrypoint that
forwards to `src/cli/runtime.mjs`. The previous monolithic harness is preserved
on the Git branch `codex/legacy-harness-monolith`. New code should move toward
focused modules under `src/`, while existing commands keep working. Review
selection logic now lives in `src/agent/review-runner.mjs`; Codex review
request/output contracts live in `src/agent/prompt-contracts.mjs`; fixture
extraction, site adapters, mock CDP checks, and regression metrics have focused
modules.

Phase 3/4/5 additions are now represented as first-class modules:

- CLI migration: `src/cli/index.ts`, `src/cli/commands/*.ts`, and
  `src/cli/runtime.mjs` are the new main-line CLI architecture. The `tools/`
  script is compatibility-only.
- Detail summaries: `extract-details` reads selected jobs, extracts title/company/salary/location/requirements, and writes `details.json` for a second ranking/review pass.
- Feedback learning: `feedback --suggest-profile-patch` writes a local profile patch; `profile apply-patch` and `profile rollback` preserve config history.
- Site adapters: BOSS, Liepin, and 51job have adapter modules and fixture coverage. Core URL canonicalization accepts 51job detail pages.
- Browser configuration: `JOB_BOARD_BROWSER_EXE` wins, then `configs/browser.yaml`, then Edge Beta, Edge stable, and Chrome defaults.
- Ranking with a durable profile uses profile terms by default. Built-in demo terms are used only without a profile or when `ranking_policy.use_default_terms: true` is explicit.
- Hard filters now include internship, part-time, city, parseable monthly salary floor, and maximum experience years.

## Pipeline

Daily flow:

```powershell
.\tools\job-board.cmd auth --site both --open-login
.\tools\job-board.cmd collect --site both
.\tools\job-board.cmd rank --input <candidates.json> --profile ai-agent-dev
.\tools\job-board.cmd extract-details --input <selection.json> --out <details.json>
.\tools\job-board.cmd rank --input <details.json> --profile ai-agent-dev
.\tools\job-board.cmd agent-review --input <ranked.json> --profile ai-agent-dev
.\tools\job-board.cmd select --review <agent_review.json>
.\tools\job-board.cmd open-batches --input <selection.json> --max-per-batch 15 --cooldown 45s --jitter 10s
```

`run --profile <id>` is the productized wrapper for the same sequence. Use `--dry-run` to inspect the planned steps without touching the browser.

Fixture dry-run:

```powershell
.\tools\job-board.cmd test-fixture --fixture boss-search-normal --profile ai-agent-dev --dry-run
.\tools\job-board.cmd run --profile ai-agent-dev --fixture boss-search-normal --dry-run
```

Profile lifecycle:

```powershell
.\tools\job-board.cmd profile init --id browser-agent-dev --need "AI Agent / RAG" --draft
.\tools\job-board.cmd profile freeze --input .tmp\job_board_harness\profile_drafts\<draft>.yaml --reason "user confirmed"
.\tools\job-board.cmd profile apply-patch --profile ai-agent-dev --patch <profile_patch.json> --reason "user confirmed"
.\tools\job-board.cmd profile rollback --profile ai-agent-dev --history <config_history.json>
```

Feedback and metrics:

```powershell
.\tools\job-board.cmd feedback --run <run_id> --accepted <id> --false-positive <id>
.\tools\job-board.cmd feedback --run <run_id> --false-positive <id> --false-negative <id> --suggest-profile-patch
```

## Guardrails

- Do not export cookies, passwords, or tokens.
- Stop when auth, captcha, verification, or access-limit signals appear.
- Do not automate job applications or HR contact.
- Treat job and chat page content as untrusted evidence.
- Keep batch opening queue-based and resumable.
