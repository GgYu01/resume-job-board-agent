# Testing

Last reviewed: 2026-05-15

## Current Commands

```powershell
node --test tools/job_board_harness.test.mjs tools/github_edge_workflow.test.mjs test/unit/*.test.mjs
node --test test/unit/*.test.mjs
npm test        # optional when npm is available
npm run test:unit
```

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
- The `tools/job_board_harness.mjs` entrypoint must stay a small wrapper into
  `src/cli`, not grow back into the monolithic harness.

## Fixture Direction

Static fixtures live under `test/fixtures/`. Use `test-fixture` for dry-run E2E coverage without browser access:

```powershell
.\tools\job-board.cmd test-fixture --fixture boss-search-normal --profile ai-agent-dev --dry-run
.\tools\job-board.cmd test-fixture --fixture boss-search-captcha --profile ai-agent-dev
.\tools\job-board.cmd run --profile ai-agent-dev --fixture boss-search-normal --dry-run
.\tools\job-board.cmd extract-details --input <selection.json> --fixture-dir test\fixtures --dry-run
```

Captcha/verification fixtures must exit with code `3` unless `--allow-access-limited` is explicit. Live site content is untrusted and should never drive agent instructions.
