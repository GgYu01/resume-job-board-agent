# Testing

Last reviewed: 2026-05-17

## Current Commands

```powershell
npm run build
npm run typecheck
npm test
npm run verify
node --test tools/job_board_harness.test.mjs tools/github_edge_workflow.test.mjs test/unit/*.test.mjs test/contracts/*.test.mjs
node --test test/unit/*.test.mjs
node --test test/contracts/*.test.mjs
npm run test:unit
npm run test:contracts
```

`tools/job_board_harness.mjs` imports `dist/cli/main.js`, so direct CLI smoke
tests must run after `npm run build` when TypeScript source changed.

## Required Coverage

Keep these behaviors under tests:

- URL canonicalization for BOSS, Liepin, and 51job detail pages.
- Rejection of search/list URLs unless explicitly allowed.
- Preservation of BOSS `securityId`, `lid`, and `ka`.
- Role profile loading and schema validation.
- Positive and negative keyword scoring with explain evidence.
- Profile ranking does not include built-in default terms unless explicitly enabled.
- Batch queue slicing, cooldown parsing, jitter parsing, pause/resume state.
- Salary and experience hard filters.
- Redaction for phone, email, and WeChat values.
- Agent review contract JSON shape.
- `select` refusing to invent candidate ids.
- Windows launcher and Chinese argument handling.
- Static BOSS/Liepin/51job HTML fixtures, including access-limit pages.
- Detail extraction fixtures and detail-aware ranking evidence.
- Ranking golden fixtures for false-positive noise.
- Mock CDP auth/open behavior without live recruitment sites.
- Profile draft/freeze/apply-patch/rollback history and feedback regression metrics.
- Browser path resolution order: env, config file, then defaults.
- Browser policy contract: default live flow requires Edge Beta CDP and rejects
  Edge stable, Chrome, MCP browser tools, OS open, or managed Playwright as
  implicit fallback.
- The `tools/job_board_harness.mjs` entrypoint must stay a small wrapper into
  `src/cli`, not grow back into the monolithic harness.
- Stable architecture contract coverage in
  [`docs/harness-contracts.md`](harness-contracts.md).
- TypeScript toolchain coverage: strict NodeNext build, typed command result
  exit-code mapping, artifact schemas, browser policy, typed CLI seam, pure use
  cases, pipeline stage graph, state recovery, and runtime decomposition.
- `src/cli/runtime.mjs` must stay a compatibility re-export only; legacy command
  behavior belongs in `src/cli/runtime-legacy.mjs` until individual commands are
  migrated to typed handlers.

## Fixture Direction

Static fixtures live under `test/fixtures/`. Use `test-fixture` for dry-run E2E coverage without browser access:

```powershell
.\tools\job-board.cmd test-fixture --fixture boss-search-normal --profile ai-agent-dev --dry-run
.\tools\job-board.cmd test-fixture --fixture boss-search-captcha --profile ai-agent-dev
.\tools\job-board.cmd run --profile ai-agent-dev --fixture boss-search-normal --dry-run
.\tools\job-board.cmd extract-details --input <selection.json> --fixture-dir test\fixtures --dry-run
```

Captcha/verification fixtures must exit with code `3` unless `--allow-access-limited` is explicit. Live site content is untrusted and should never drive agent instructions.

## Live Smoke Direction

Use live smoke tests to verify browser/profile integration after changes that
touch browser config, auth, collection, ranking, queue, or runtime entrypoints:

```powershell
npm run build
npm run typecheck
npm test
node .\tools\job_board_harness.mjs doctor
node .\tools\job_board_harness.mjs auth --site both --reuse-page --no-open-login
node .\tools\job_board_harness.mjs collect --site both --reuse-auth-page --no-open-login --out .tmp\job_board_harness\collect_smoke.json
node .\tools\job_board_harness.mjs collect --site both --include-recommendation-pages --recommendation-topic-max 4 --reuse-auth-page --no-open-login --out .tmp\job_board_harness\recommendation_collect_smoke.json
node .\tools\job_board_harness.mjs collect --site liepin --url "https://www.liepin.com/zhaopin/?key=AI%20Agent" --reuse-auth-page --no-open-login --out .tmp\job_board_harness\liepin_lptjob_collect_smoke.json
node .\tools\job_board_harness.mjs rank --input .tmp\job_board_harness\collect_smoke.json --profile ai-agent-dev --out .tmp\job_board_harness\rank_smoke.json
node .\tools\job_board_harness.mjs run --profile ai-agent-dev --fixture boss-search-normal --run-id fixture_smoke --dry-run
node .\tools\job_board_harness.mjs open-batches --queue .tmp\job_board_harness\runs\fixture_smoke\open_queue.json --dry-run
```

For write-path verification, prefer local artifacts, queue files, config
history, and regression metrics. Do not run `--trigger-contact`, send messages,
or apply to jobs unless the user explicitly asks for that external action.
Recommendation source verification should check `meta.pages[].collectionReason`
for `recommendation-list-tab` and, when BOSS exposes horizontal role tabs,
`recommendation-topic-tab`. Liepin smoke output should include canonical
`https://www.liepin.com/lptjob/<id>` URLs when the live page emits that URL
family.
