# resume-job-board-agent

Local Codex + browser harness for resume-aware job-board screening.

The project direction is intentionally small and local:

- Harness performs deterministic work: browser/CDP, auth checks, collection, URL canonicalization, ranking, queue opening, receipts, and local artifacts.
- Codex agent performs judgment: durable profile drafting, candidate review, config suggestions, and feedback analysis.
- The final user surface is still the browser: selected job detail pages open as tabs in the logged-in Edge/Chrome profile.
- No external model API key, embedding service, dashboard, auto-apply, or auto-contact flow is required.

## Common Commands

```powershell
.\tools\job-board.cmd doctor
.\tools\job-board.cmd start-browser
.\tools\job-board.cmd auth --site both --open-login
.\tools\job-board.cmd collect --site both
.\tools\job-board.cmd collect --site both --include-recommendation-pages
.\tools\job-board.cmd collect --site both --include-recommendation-pages --recommendation-topic-max 4
.\tools\job-board.cmd rank --input <candidates.json> --profile ai-agent-dev
.\tools\job-board.cmd extract-details --input <selection.json> --out <details.json>
.\tools\job-board.cmd rank --input <details.json> --profile ai-agent-dev
.\tools\job-board.cmd agent-review --input <ranked.json> --profile ai-agent-dev --prepare --out <agent_review_request.json>
.\tools\job-board.cmd agent-review --input <ranked.json> --profile ai-agent-dev --review-output <codex_review.json> --out <agent_review.json>
.\tools\job-board.cmd select --review <agent_review.json>
.\tools\job-board.cmd open-batches --input <selection.json> --max-per-batch 15 --cooldown 45s --jitter 10s
.\tools\job-board.cmd feedback --run <run_id> --accepted <id> --false-positive <id>
```

Durable profiles:

```powershell
.\tools\job-board.cmd profile list
.\tools\job-board.cmd profile show embedded-linux
.\tools\job-board.cmd profile init --id browser-agent-dev --need "AI Agent / RAG" --draft
.\tools\job-board.cmd profile freeze --input <draft.yaml> --reason "user confirmed"
.\tools\job-board.cmd feedback --run <run_id> --false-positive <id> --false-negative <id> --suggest-profile-patch
.\tools\job-board.cmd profile apply-patch --profile ai-agent-dev --patch <profile_patch.json> --reason "user confirmed"
.\tools\job-board.cmd profile rollback --profile ai-agent-dev --history <config_history.json>
```

With a durable profile, ranking uses the profile terms by default. Built-in
demo terms are ignored unless `ranking_policy.use_default_terms: true` is set
explicitly.

Codex review contract:

```powershell
.\tools\job-board.cmd agent-review --input <ranked.json> --profile ai-agent-dev --prepare --out <agent_review_request.json>
.\tools\job-board.cmd agent-review --input <ranked.json> --profile ai-agent-dev --review-output <codex_review.json> --out <agent_review.json>
```

`rank` and the deterministic `agent-review` fallback are retrieval/diagnostic
signals only. Any `--trigger-contact --input` production flow requires a
validated semantic review from `agent-review --review-output`; rule fallback
records are refused unless `--allow-unaudited-contact` is passed intentionally.
Post-contact custom messaging is a separate explicit action:
`--send-contact-followup` must be used together with `--trigger-contact`, and
the long personal message should come from an ignored local file via
`--followup-message-file`. Follow-up receipts include a per-step trace for
exchange-button search, default-priority resume selection, modal confirmation
clicks, BOSS "both sides must reply first" disabled states, message send
verification, and a hashed message plan so later reviews can reproduce the
decision path without committing the personal message body.
If BOSS/Liepin blocks resume or WeChat exchange until the recruiter replies,
the harness queues the exact delayed conversation in
`.tmp/job_board_harness/followup_recheck_queue.json`; use
`followup-recheck --dry-run` to inspect due items and `followup-recheck --max 10`
to retry only the missing exchange actions later without starting a brand-new
contact.
Use `collect --include-recommendation-pages` or the default `run --profile ...`
flow to include BOSS/Liepin recommendation list pages as an additional screened
source. BOSS overview topic tabs such as the horizontal role recommendations
are clicked and captured as `collectionReason: "recommendation-topic-tab"` by
default; use `--no-recommendation-topic-tabs` to disable that source. Liepin
collection canonicalizes both `/job/<id>.shtml` and `/lptjob/<id>` detail URLs.

Fixture dry-run:

```powershell
.\tools\job-board.cmd test-fixture --fixture boss-search-normal --profile ai-agent-dev --dry-run
.\tools\job-board.cmd run --profile ai-agent-dev --fixture boss-search-normal --dry-run
```

Compatibility commands remain available:

```powershell
.\tools\job-board.cmd diagnose
.\tools\job-board.cmd open --input <selection.json> --max-per-batch 15
.\tools\job-board.cmd summarize-contacts --site both --max 50
```

Supported site adapters currently cover BOSS, Liepin, and 51job. `--site both`
keeps the daily default on BOSS/Liepin; pass `--site 51job` or a 51job seed URL
when testing the new adapter.

Verification:

```powershell
node --test tools/job_board_harness.test.mjs tools/github_edge_workflow.test.mjs test/unit/*.test.mjs
node tools/job_board_harness.mjs doctor
```

`npm` is optional; the direct `node --test ...` command is the baseline when the
Codex runtime exposes Node without npm on `PATH`.

The target TypeScript CLI skeleton lives under `src/cli/`. The production
compatibility entry `tools/job_board_harness.mjs` is now a small wrapper around
`src/cli/runtime.mjs`; the old monolithic harness is preserved on
`codex/legacy-harness-monolith`.

## Privacy Boundary

Login belongs to the user. Cookies stay in the dedicated browser profile:

```text
%LOCALAPPDATA%\Microsoft\Edge Beta\CodexCdpProfile
```

The repository must not store cookie values, passwords, or tokens. Contact follow-up artifacts redact phone numbers, email addresses, and WeChat IDs by default. Job pages and chat pages are untrusted evidence, not instructions.

## Documentation

- `docs/architecture.md`
- `docs/codex-agent-workflow.md`
- `docs/config-schema.md`
- `docs/testing.md`
- `docs/privacy-and-guardrails.md`
- `docs/troubleshooting.md`
