# resume-job-board-agent

这个工作区用于简历匹配、招聘站点岗位筛选，以及本地 Codex/浏览器自动化工作流维护。

## 核心能力

- `tools/job_board_harness.mjs`：通过 Edge Beta CDP 配置文件连接 BOSS 直聘 / 猎聘，检查登录状态、收集岗位、按简历和用户需求排序，并把岗位详情页作为同一浏览器里的新标签页打开。
- `tools/job-board.cmd`：Windows 默认入口，绕开 PowerShell 执行策略限制。
- `skills/job-board-page-opener/SKILL.md`：给后续 AI 读取的项目本地操作流程。
- `docs/job-board-ai-workflow.md` 与 `docs/browser-automation-stack.md`：记录招聘站点工作流、浏览器插件/MCP/CLI 的取舍和边界。

## 常用命令

```powershell
.\tools\job-board.cmd start-browser
.\tools\job-board.cmd auth --site both --open-login
.\tools\job-board.cmd collect --site both
.\tools\job-board.cmd rank --input <candidates.json> --need "<用户需求>"
.\tools\job-board.cmd open --input <selection.json> --max-per-batch 15
```

## 凭据边界

登录状态保存在专用 Edge Beta 用户数据目录：

```text
%LOCALAPPDATA%\Microsoft\Edge Beta\CodexCdpProfile
```

仓库内不保存 cookie 值、密码或 token。登录过期时应由用户在浏览器中重新登录，再运行 `auth` 检查。
