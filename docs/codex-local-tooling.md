# Codex Local Tooling

Last reviewed: 2026-05-14

## Codex CLI

- Binary: `/usr/local/bin/codex`
- Package: global npm package `@openai/codex`
- Preview channel checked: npm dist-tag `alpha`
- Current verified version: `codex-cli 0.126.0-alpha.1`
- Update command:

```bash
sudo npm install -g @openai/codex@alpha --registry=https://registry.npmmirror.com
```

## Package Mirrors

- npm registry is set to `https://registry.npmmirror.com`.
- APT sources use Aliyun Debian mirrors under `/etc/apt/sources.list.d/debian.sources`.

## MCP Servers In Codex Config

The local Codex config at `/home/devops/.codex/config.toml` contains these MCP
servers. They do not require a new user account for normal use.

| Server | Purpose | Deployment Mode | Status |
| --- | --- | --- | --- |
| `filesystem` | Read/write allowed local directories | `npx @modelcontextprotocol/server-filesystem /workspaces /home/devops` | Verified by listing this workspace |
| `sequential-thinking` | Structured reasoning helper | `npx @modelcontextprotocol/server-sequential-thinking` | CLI startup verified |
| `context7` | Library documentation lookup | `npx @upstash/context7-mcp` | Help command verified; API key only needed for optional research mode |
| `chrome-devtools` | Browser debugging and audits | `npx chrome-devtools-mcp` with Chromium headless args | Config updated; standalone startup verified |
| `deepwiki` | Repository wiki lookup | `npx mcp-deepwiki` | Tool call verified |
| `browser-use` | Playwright browser automation | `npx @playwright/mcp` | Verified by opening `https://example.com` |
| `page-agent` | Browser task automation | `npx @page-agent/mcp` | Existing local port detected; no account prompt observed |
| `excel-mcp-server` | Spreadsheet operations | `npx excel-mcp-server` with local Python path | Verified with local `pandas`/`openpyxl` path |

Chromium support was installed from the Aliyun Debian mirror:

```bash
sudo apt-get update
sudo apt-get install -y chromium chromium-driver chromium-sandbox
sudo mkdir -p /opt/google/chrome
sudo ln -sf /usr/bin/chromium /opt/google/chrome/chrome
```

Excel MCP uses the local Python path
`/home/devops/.codex/mcp-venvs/excel/lib/python3.11/site-packages`, currently
verified with `pandas 3.0.2`, `openpyxl 3.1.5`, and `numpy 2.4.4`.

## Available Skills

Use only the skills that match the current task to avoid context bloat.

| Skill | Use When |
| --- | --- |
| `planning-with-files` | Multi-step work or research requiring persistent task state |
| `writing-plans` | Full implementation plans before code changes |
| `systematic-debugging` | Bugs, failures, or unexpected behavior |
| `security-review` | Security audit, secret exposure, auth, injection, dependency risk |
| `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines` | Frontend/UI creation or review |
| `openai-docs` | OpenAI product/API questions that need current official docs |
| `skill-creator`, `skill-installer`, `find-skills` | Creating, installing, or discovering skills |
| `deploy-to-vercel`, `vercel-cli-with-tokens` | Vercel deployment work |
| Backend/architecture/k8s/CI skills | Use for matching backend, architecture, Kubernetes, Jenkins, or pipeline tasks |

## Tooling Governance

- Project-local CLI helper `tools/edge_background_tabs_cdp.py` is available for Edge Beta no-focus job-tab opening, but only when CDP is enabled.
- `context-engine` was removed from Codex MCP config on 2026-04-25 because it
  returned an API-key requirement during validation, which conflicts with the
  local no-account MCP policy for this workspace.
- Review cadence: after every major task, decide whether repeated work justifies
  a project-local tool. If it was one-off or too narrow, do not add it.
- Decay rule: if a project-local tool is not used for three relevant task
  reviews, lower its priority or remove it after confirming no active workflow
  depends on it.
- Current conclusion: keep this workspace lightweight; use global Codex skills and MCP services by default; keep the small Edge CDP helper because repeated job-screening work needs a safe no-focus guardrail.

## Edge Beta no-focus background tab helper

Last verified: 2026-05-08 on Windows / Edge Beta.

## Problem

Opening URLs with `msedge.exe --new-tab <url>` or PowerShell `Start-Process`
can activate the Edge Beta window. A Win32 `SetForegroundWindow` restore after
the call is only a mitigation: it can still visibly steal focus during bulk
opens, and sometimes Edge remains foreground after the batch.

## Supported safe path

Use Chrome DevTools Protocol (CDP) against an Edge Beta session that was already
started with a remote debugging port, then create tabs through
`Target.createTarget` with `background: true`. If CDP is not available, do not
fall back to the CLI open path for bulk job tabs; export a URL list instead.

Local helper:

```powershell
python .\tools\edge_background_tabs_cdp.py --diagnose
python .\tools\edge_background_tabs_cdp.py --launch-hint
python .\tools\edge_background_tabs_cdp.py --port 9222 --file .\.tmp\urls.txt --delay 0.8
```

The helper intentionally refuses to open anything unless it can connect to CDP,
so it does not accidentally use a focus-stealing fallback.

## Current local status

Verified command on 2026-05-08:

```powershell
python .\tools\edge_background_tabs_cdp.py --diagnose
```

Observed result: Edge Beta was running, but no `--remote-debugging-port` flag was
present and ports `9222..9230` had no CDP `/json/version` endpoint. Therefore
true no-focus background tab injection is currently blocked for the existing Edge
Beta session.

## User action needed for CDP mode

Start a dedicated Edge Beta CDP profile before asking Codex to open batches:

```powershell
"C:\Program Files (x86)\Microsoft\Edge Beta\Application\msedge.exe" `
  --remote-debugging-port=9222 `
  --remote-allow-origins=http://127.0.0.1:9222 `
  --user-data-dir="$env:LOCALAPPDATA\Microsoft\Edge Beta\CodexCdpProfile"
```

Use a non-default `--user-data-dir` for security isolation. Keep the port bound
only to localhost. Do not persist cookies, sessions, or other secrets in this
workspace.

## MCP / Playwright note

- Playwright can attach with `chromium.connect_over_cdp("http://127.0.0.1:9222")`
  once Edge exposes CDP, and the helper uses Playwright only as the CDP transport.
- `chrome-devtools-mcp` also supports `--browserUrl http://127.0.0.1:9222`, but
  it still requires a debuggable browser; it cannot attach to a normal Edge Beta
  instance that was launched without remote debugging.
- Launching a separate Playwright/Chromium browser or MCP-managed browser is not
  equivalent to opening tabs in the user's already-open Edge Beta window.


### 2026-05-08 CDP helper verification update

- Dedicated Edge Beta CDP profile successfully launched at `%LOCALAPPDATA%\Microsoft\Edge Beta\CodexCdpProfile` with port `9222`.
- Login state was verified on Liepin without reading or persisting cookies.
- `tools/edge_background_tabs_cdp.py` was updated to avoid closing the Playwright CDP browser object after `Target.createTarget`; closing it caused newly-created targets to disappear on this Edge build.
- Verified background opening of 10 Liepin job detail pages: target count matched and foreground window handle stayed unchanged.

### 2026-05-08 CDP batch usage update

- Verified two 15-tab Liepin batches through the dedicated Edge Beta CDP profile; all 30 job detail targets were present in `/json/list` and foreground window stayed unchanged in both helper receipts.
- `liepin_opened_ids_current.txt` was updated after verification, not before, to preserve dedup correctness.

## BOSS / Liepin AI job-board workflow

Last reviewed: 2026-05-14 on Windows / Codex Desktop.

Added project-local workflow assets:

- `tools/job_board_harness.mjs`: Node CDP harness for logged-in BOSS直聘 / 猎聘
  pages. It can diagnose CDP, extract resume text, collect job detail links,
  rank candidates against resume and user needs, and open selected detail pages
  as background tabs via `Target.createTarget`.
- `tools/job-board.cmd`: execution-policy-safe Windows launcher for the harness.
- `tools/job-board.ps1`: PowerShell launcher, available when script execution is
  permitted.
- `skills/job-board-page-opener/SKILL.md`: project-local agent workflow for this
  repeated job-screening task.
- `docs/job-board-ai-workflow.md`: operational runbook and guardrails.

Verified commands:

```powershell
.\tools\job-board.cmd help
.\tools\job-board.cmd workflow
.\tools\job-board.cmd resume --file 求职简历.docx
.\tools\job-board.cmd rank --input .tmp\liepin_10_new_fit_candidates_20260508_171108.json --need "AI Agent / 嵌入式 Linux / DevOps / K8s" --max 5 --min-score 1 --out .tmp\job_board_harness\verify_selection.json
.\tools\job-board.cmd open --input .tmp\job_board_harness\verify_selection.json --dry-run
```

Observed status:

- Bundled Codex Node works for the harness.
- Current `python` command in PowerShell points to the Windows Store alias, so
  the new harness avoids Python and Playwright as required runtime dependencies.
- Direct `.ps1` execution is blocked by the current PowerShell execution policy;
  use `job-board.cmd` by default.
- Current ports `9222..9230` did not expose CDP during verification, so live
  tab-opening still requires the user to start the dedicated Edge Beta CDP
  profile and log in manually first.

### 2026-05-14 login-state hardening update

- `tools/job_board_harness.mjs` now has `start-browser` and `auth` commands.
- The durable login-state boundary is the Edge profile at
  `%LOCALAPPDATA%\Microsoft\Edge Beta\CodexCdpProfile`.
- Cookie values, passwords, and tokens are not exported into this workspace.
  `auth` records only status metadata and cookie counts in
  `.tmp/job_board_harness/auth_status.json`.
- `collect` and `open` now run an auth gate by default. If login is expired or
  verification is required, the CLI opens the relevant site page and refuses the
  batch until the user finishes login/verification and reruns `auth`.
- Verified on 2026-05-14: `.\tools\job-board.cmd auth --site both --open-login`
  reported BOSS and Liepin as logged in through the Edge CDP profile.

## Browser automation stack audit

Last reviewed: 2026-05-14 on Windows / Codex Desktop.

| Capability | Current observation | Use for this workspace |
| --- | --- | --- |
| `tools/job_board_harness.mjs` | Uses Edge Beta CDP profile directly; verified with logged-in BOSS/Liepin state | Primary path for job-board screening and tab opening |
| `chrome-devtools` MCP | Callable tool is available, but currently lists an MCP-managed `about:blank` page, not the Edge Beta CDP profile | Useful for generic page inspection/audits, not the source of recruitment login persistence |
| `playwright-mcp` | Callable tool is available, but currently lists an MCP-managed `about:blank` page | Useful for generic browser automation, not the recruitment login profile |
| `playwriter` | Callable extension automation is available when a tab has the extension enabled | Use for interactive tab work when needed; do not rely on it for durable job-board login state |
| `page-agent` MCP | Configured in `C:\Users\Administration\.codex\config.toml`, but no direct `page-agent` callable tool surfaced in this session | Treat as installed but not currently exposed; do not make it a required path |
| `browser-use` plugin/MCP | Configured and available as a managed automation path | Useful fallback for generic browsing, not same-profile BOSS/Liepin persistence |

Conclusion: browser plugins/MCPs are useful for inspection and interaction, but
the repeatable job-board workflow should keep using the project CDP harness
because it targets the same durable Edge Beta profile where the user logs in.

Governance conclusion: keep both the older low-level
`tools/edge_background_tabs_cdp.py` and the new job-board harness. The Python
helper remains useful for direct URL batches when Python/Playwright is present;
the Node harness is the preferred AI-facing workflow because it covers resume
extraction, candidate collection, ranking, dedup, dry-run, and background tab
opening without storing credentials.

## GitHub Edge stable workflow

Last reviewed: 2026-05-14 on Windows / Codex Desktop.

Added project-local workflow assets:

- `tools/github_edge_workflow.mjs`: Node helper that checks Edge stable process
  status, local git remote state, and GitHub repository existence, then opens
  GitHub create/delete/target pages in Microsoft Edge stable.
- `tools/github-edge.cmd`: Windows launcher that finds bundled Codex Node first.
- `tools/github-edge.ps1`: PowerShell launcher for environments that permit
  script execution.

Verified status on 2026-05-14:

- Codex GitHub connector authenticated as `GgYu01`.
- Git Credential Manager returned a GitHub OAuth credential for `GgYu01` with
  repo/workflow access.
- `GgYu01/work_jianli` returned 404 through authenticated GitHub API checks, so
  no legacy remote deletion was needed.
- `GgYu01/resume-job-board-agent` was created as a public repository with admin
  permissions for the authenticated user.

Operational boundary:

- Use Microsoft Edge stable for GitHub browser workflows because the user's
  network path depends on it; do not switch this workflow to Edge Beta unless
  the user explicitly changes that requirement.
- The helper opens pages in the user's Edge stable profile but does not read or
  export browser cookies, passwords, or tokens.
