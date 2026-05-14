# Findings

## Workspace
- /workspaces/work_jianli is not a git repository.
- No AGENTS.md governs /workspaces/work_jianli from filesystem search; user prompt instructions apply.
- Current files are resume DOCX variants and a previous edit report.
- Codex binary: /usr/local/bin/codex -> /usr/local/lib/node_modules/@openai/codex/bin/codex.js.
- Current Codex version: 0.126.0-alpha.1.
- npm @openai/codex dist-tags from npmmirror: latest 0.125.0, alpha 0.126.0-alpha.1; no next tag.

## MCP
- ~/.codex/config.toml defines filesystem, sequential-thinking, context7, chrome-devtools, deepwiki, browser-use, page-agent, excel-mcp-server.
- MCP server env blocks use npm_config_registry=https://registry.npmmirror.com where relevant.
- context-engine was removed after validation because it requires an API key for production use.

## Web Research
- LZL official join page lists company name, contacts, and locations, but no actual open position list.
- LZL official about/home/news pages identify the company as 零重力飞机工业（合肥）有限公司, focused on eCTOL/eVTOL aircraft, with products RX1E-A/RX1E-S/ZG-ONE/ZG-T6 and sites in Hefei, Nanjing, Shenzhen, Jiaxing/Pinghu and other locations.
- Official news around 2026-04-02 reports Pre-B financing of RMB 150 million, and recent pages show ongoing product demos, awards, and low-altitude economy activity.
- BOSS desktop URL redirects to security-check and could not be directly read by curl or Playwright in this environment.
- Public mobile/search result snippets for the same BOSS company show active/recent roles including 运维工程师, 系统验证工程师, 前端开发资深工程师, 嵌入式软件资深工程师, 测试高级工程师, C++开发工程师, 通信系统工程师, 显控系统工程师, 飞控工程师, 地面站开发工程师, 后端开发工程师, 结构设计工程师, and 试飞安全工程师.
- Resume profile: 25, CS本科 with bioengineering minor, Guangzhou; embedded Linux/Android driver debugging, MTK/Qualcomm, TP/LCD/GPIO/ESD; current MTK automotive Hypervisor/virtio/vsock integration, release/quality/ASPICE, K8s/Jenkins/Argo/Helm/Terraform/observability, network room maintenance, AI Agent/RAG workflow.
