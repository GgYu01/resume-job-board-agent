# Troubleshooting

Last reviewed: 2026-05-15

## Doctor

Run:

```powershell
.\tools\job-board.cmd doctor
```

It checks Node, browser path, browser profile path, CDP availability, `.tmp` writability, role profiles, batch config, and Chinese-argument risk.

## Browser Not Found

Resolution order:

1. `JOB_BOARD_BROWSER_EXE`
2. `configs/browser.yaml` `browser_exe`
3. Edge Beta default path
4. Edge stable default path
5. Chrome default path

Use `launch-hint` to print the exact CDP launch command.

## CDP Not Available

Run:

```powershell
.\tools\job-board.cmd start-browser
.\tools\job-board.cmd diagnose
```

Keep the browser open and rerun `auth`.

## Chinese Arguments Garbled

`tools/job-board.cmd` switches to UTF-8 with `chcp 65001`. For long Chinese strings, call Node directly with the Codex bundled runtime as documented in `docs/job-board-ai-workflow.md`.

## Queue Interrupted

If `collect`, `open`, `open-batches`, or `test-fixture` reports `access_limited`
or exits with code `3`, fix the browser state manually. Do not increase
frequency or batch size to work around captcha/verification.

Then resume queued opening:

```powershell
.\tools\job-board.cmd open-batches --resume --queue .tmp\job_board_harness\open_queue.json
```

Do not pass `--allow-previous` unless repeated opens are intentional.

## Detail Extraction Interrupted

`extract-details` opens detail pages in controlled chunks. If it reports
`access_limited` or exits with code `3`, stop and fix the browser state manually.
Resume from the last saved selection or details artifact after captcha or
verification is cleared.

## Fixture Dry-run

Use fixtures before touching live extraction logic:

```powershell
.\tools\job-board.cmd test-fixture --fixture boss-search-normal --profile ai-agent-dev --dry-run
.\tools\job-board.cmd test-fixture --fixture liepin-search-normal --profile devops-sre --dry-run
.\tools\job-board.cmd extract-details --input <selection.json> --fixture-dir test\fixtures --dry-run
```
