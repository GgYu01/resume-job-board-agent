# Browser Automation Stack

Last reviewed: 2026-05-17

## Durable Login Boundary

Use the dedicated Edge Beta CDP profile for BOSS直聘 / 猎聘:

```text
%LOCALAPPDATA%\Microsoft\Edge Beta\CodexCdpProfile
```

This is where site cookies and login state persist. Do not export cookie values,
passwords, tokens, or browser profile files into this workspace.

## Required Preflight

Run before collecting or opening job pages:

```powershell
.\tools\job-board.cmd start-browser
.\tools\job-board.cmd auth --site both --open-login
```

Continue only when the required site reports `logged-in` or
`probably-logged-in`. If it reports `login-required`, `needs-user-action`, or
`unknown`, finish login/verification in Edge and rerun the auth command.

## Tool Choice

| Tool | Role |
| --- | --- |
| `tools/job-board.cmd` / `tools/job_board_harness.mjs` | Primary job-board workflow. The wrapper enters the built TypeScript CLI and delegates unmigrated commands to the legacy runtime. Uses the durable Edge Beta profile, collects/ranks jobs, summarizes contact or interview follow-ups, and opens detail pages as same-browser tabs. |
| `chrome-devtools` MCP | Generic page inspection/audits. Current callable instance is not the Edge Beta recruitment profile. |
| `playwright-mcp` | Generic managed browser automation. Current callable instance is not the Edge Beta recruitment profile. |
| `playwriter` | Extension-based interactive control for user browser tabs when enabled. Useful for manual interaction loops, not required for batch opening. |
| `page-agent` MCP | Installed/configured, but no direct callable tool was exposed in this session. Treat as unavailable until Codex exposes a concrete tool. |
| `browser-use` | Generic browser automation fallback, not the durable recruitment login profile. |

## Operational Rule

For BOSS/Liepin/51job job screening, future agents should use the project
harness first. No MCP fallback is allowed for collect/open/open-batches/run.
Use extension/MCP browser tools only for inspection, captcha/user-assisted
interaction, or explicit one-off diagnostics outside the job-board pipeline.
The typed browser boundary lives under `src/browser/*.ts`; the live pipeline
still requires Edge Beta CDP unless a diagnostic-only fallback is explicitly
configured.

The detailed browser boundary is part of
[`docs/harness-contracts.md`](harness-contracts.md).

`open` should leave the browser on detail pages. It rejects BOSS/Liepin
search/list URLs by default and closes BOSS `/web/geek/jobs` plus Liepin
`/zhaopin/` tabs after successful live batches. Use
`.\tools\job-board.cmd cleanup-pages` for manual cleanup when needed.
