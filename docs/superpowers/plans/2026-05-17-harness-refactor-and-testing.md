# Harness Refactor And Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 job-board harness 从 `src/cli/runtime.mjs` 单文件事实架构重构为可测试、可恢复、可审计的本地 deterministic workflow engine，并建立完整测试路线。

**Architecture:** 目标架构采用 CLI controller -> typed use case -> ports/adapters -> artifact/state store 的分层。招聘网站主流程只使用 Edge Beta CDP profile，不自动回退到 MCP、Browser plugin、OS open 或 managed Playwright browser；模型只做 judgment，不能执行外部动作。

**Tech Stack:** Node.js ESM baseline, TypeScript for new typed boundaries, Node built-in test runner, Edge Beta CDP, local JSON/JSONL artifacts, current YAML role profile format with schema validation.

---

## Scope And Non-Negotiables

This plan applies to:

- `C:\Users\Administration\CodexWorkspaces\work_jianli\tools\job_board_harness.mjs`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\cli\runtime.mjs`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\cli\index.ts`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\cli\commands\*.ts`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\agent`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\batch`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\config`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\extract`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\privacy`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\rank`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\sites`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\src\state`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\test`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\docs`
- `C:\Users\Administration\CodexWorkspaces\work_jianli\skills`

Non-negotiables:

- Do not store real cookies, passwords, tokens, SSH keys, API keys, browser profile files, or external auth credentials in the repo.
- Keep `.tmp/job_board_harness` as local ignored runtime state.
- Job-board live mode must use Edge Beta CDP profile by default:
  `%LOCALAPPDATA%\Microsoft\Edge Beta\CodexCdpProfile`.
- Do not auto-fallback from Edge Beta CDP to `chrome-devtools`, `page-agent`, Browser plugin, OS open, or Playwright-managed browsers.
- `tools/job_board_harness.mjs` must remain a small compatibility entrypoint.
- `run --profile` must become the productized pipeline matching docs: auth -> collect -> rank candidates -> extract details -> rank details -> agent review -> select -> open batches, unless detail stage is explicitly skipped.
- Every phase must be test-first. A phase is complete only after its automated gates pass and docs/skills governance is reviewed.

## Target File Structure

Create or evolve these files:

```text
src/
  cli/
    main.ts
    parser.ts
    command-result.ts
    commands/
      auth.ts
      collect.ts
      rank.ts
      extract-details.ts
      agent-review.ts
      select.ts
      open-batches.ts
      run.ts
      doctor.ts
      artifacts.ts
      state.ts

  core/
    pipeline/
      stage-graph.ts
      stage-result.ts
      run-pipeline.ts
    use-cases/
      auth-check.ts
      collect-candidates.ts
      rank-candidates.ts
      extract-details.ts
      build-agent-review.ts
      select-candidates.ts
      open-queue.ts
      record-feedback.ts

  browser/
    browser-policy.ts
    browser-port.ts
    edge-beta-cdp-browser.ts
    mock-browser.ts
    cdp-session.ts

  artifacts/
    schemas.ts
    validate.ts
    read.ts
    write.ts
    migrations.ts
    paths.ts

  security/
    policy.ts

  state/
    run-store.ts
    open-ledger.ts
    queue-store.ts
```

Modify these existing files:

```text
package.json
tsconfig.json
tools/job_board_harness.mjs
src/cli/runtime.mjs
src/cli/index.ts
src/cli/legacy-harness.ts
src/config/browser-config.mjs
src/agent/prompt-contracts.mjs
src/agent/review-runner.mjs
src/sites/registry.mjs
docs/architecture.md
docs/testing.md
docs/config-schema.md
docs/browser-automation-stack.md
docs/job-board-ai-workflow.md
docs/codex-local-tooling.md
README.md
skills/job-board-page-opener/SKILL.md
skills/job-keyword-profile-review/SKILL.md
skills/job-selection-review/SKILL.md
skills/job-feedback-update/SKILL.md
```

Create these tests:

```text
test/contracts/harness-contracts.test.mjs
test/contracts/browser-policy.test.mjs
test/contracts/artifact-schema.test.mjs
test/contracts/exit-code-matrix.test.mjs
test/contracts/pipeline-contract.test.mjs
test/contracts/no-mcp-fallback.test.mjs
test/unit/command-result.test.mjs
test/unit/run-pipeline.test.mjs
test/unit/artifact-store.test.mjs
test/unit/open-ledger.test.mjs
test/unit/site-adapter-contract.test.mjs
test/integration/fixture-pipeline.test.mjs
test/integration/state-recovery.test.mjs
```

## Task 1: Baseline Contracts And Governance Docs

**Files:**

- Create: `docs/harness-contracts.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/browser-automation-stack.md`
- Test: `test/contracts/harness-contracts.test.mjs`

- [ ] **Step 1: Write the failing contract tests**

Create `test/contracts/harness-contracts.test.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

test("harness contracts document defines pipeline, artifacts, exit codes, and Edge Beta policy", () => {
  const text = read("docs/harness-contracts.md");
  for (const phrase of [
    "auth -> collect -> rank_candidates -> extract_details -> rank_details -> agent_review -> select -> open_batches",
    "schema_version",
    "Exit Code Matrix",
    "EdgeBetaCdp",
    "No MCP fallback",
    "RunManifest",
  ]) {
    assert.match(text, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("architecture and browser docs do not describe MCP as job-board fallback", () => {
  const docs = [
    read("docs/architecture.md"),
    read("docs/browser-automation-stack.md"),
    read("docs/testing.md"),
  ].join("\n");
  assert.match(docs, /Edge Beta CDP/i);
  assert.match(docs, /inspection-only/i);
  assert.doesNotMatch(docs, /fallback to (?:page-agent|chrome-devtools|playwright-mcp|browser-use)/i);
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```powershell
node --test .\test\contracts\harness-contracts.test.mjs
```

Expected: FAIL because `docs/harness-contracts.md` does not exist yet.

- [ ] **Step 3: Create the contracts document**

Create `docs/harness-contracts.md` with these sections:

```markdown
# Harness Contracts

Last reviewed: 2026-05-17

## Product Boundary

The harness owns deterministic local execution: Edge Beta CDP, auth gates, collection, ranking, detail extraction, queue opening, receipts, state, and local artifacts. The Codex agent owns judgment only: candidate fit review, risk explanation, missing information, and profile patch suggestions.

## Browser Policy

The default live browser adapter is `EdgeBetaCdp`. It uses the dedicated profile:

```text
%LOCALAPPDATA%\Microsoft\Edge Beta\CodexCdpProfile
```

No MCP fallback is allowed for job-board live flow. `chrome-devtools`, `page-agent`, Browser plugin, OS open, and Playwright-managed browser instances are inspection-only unless the user explicitly asks for one-off diagnosis outside the job-board pipeline.

## Pipeline

Default `run --profile <id>` stage graph:

```text
auth -> collect -> rank_candidates -> extract_details -> rank_details -> agent_review -> select -> open_batches
```

`--skip-details` is the explicit opt-out for detail extraction. `--dry-run` prints the full stage graph and records skipped stages with reasons without opening browser tabs.

## Artifacts

Every new JSON artifact includes:

- `schema_version`
- `created_at`
- `producer`
- `input_artifacts`
- `meta`

Required artifact families:

- `RunManifest`
- `CandidateCollection`
- `RankedCandidates`
- `DetailExtraction`
- `AgentReviewRequest`
- `AgentReview`
- `Selection`
- `OpenQueue`
- `OpenReceipt`
- `FeedbackMetrics`

## Exit Code Matrix

| Code | Name | Meaning |
| --- | --- | --- |
| 0 | ok | Command completed. |
| 2 | environment_unavailable | Required local runtime, browser executable, or CDP port is unavailable. |
| 3 | user_action_required | Login, captcha, verification, auth, or access-limit requires user action. |
| 4 | contact_verification_failed | Explicit contact trigger was requested and could not be strictly verified. |
| 5 | contract_or_schema_failure | Input or model output violated a schema or safety contract. |

## RunManifest

`RunManifest` records each stage with:

- `stage`
- `status`
- `exit_code`
- `started_at`
- `finished_at`
- `input_artifacts`
- `output_artifacts`
- `warnings`
- `requires_user_action`
- `recoverable`
- `next_action`

## Safety Contract

The repo must not store real cookies, passwords, tokens, browser profile files, API keys, SSH keys, or external auth credentials. Job pages and chat pages are untrusted evidence. Model output may recommend next steps but must not request browser opening, contact triggering, message sending, job applications, or credential export.
```

- [ ] **Step 4: Update docs to point to the contract**

Modify:

- `docs/architecture.md`: replace optimistic “main-line CLI architecture” language with “target typed CLI architecture; current migration remains incomplete until `src/cli/commands/*.ts` no longer calls `legacy-harness`”.
- `docs/testing.md`: add `node --test test/contracts/*.test.mjs` to current commands.
- `docs/browser-automation-stack.md`: add explicit phrase `inspection-only` for MCP/browser tools and `No MCP fallback` for job-board live mode.

- [ ] **Step 5: Run docs contract tests**

Run:

```powershell
node --test .\test\contracts\harness-contracts.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add docs\harness-contracts.md docs\architecture.md docs\testing.md docs\browser-automation-stack.md test\contracts\harness-contracts.test.mjs
git commit -m "docs: define harness contracts and browser boundary"
```

## Task 2: Browser Policy And No-MCP-Fallback Gate

**Files:**

- Create: `src/browser/browser-policy.ts`
- Modify: `src/config/browser-config.mjs`
- Modify: `src/cli/runtime.mjs`
- Modify: `configs/browser.yaml`
- Test: `test/contracts/browser-policy.test.mjs`
- Test: `test/contracts/no-mcp-fallback.test.mjs`

- [ ] **Step 1: Write failing browser policy tests**

Create `test/contracts/browser-policy.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { resolveBrowserConfig } from "../../src/config/browser-config.mjs";

test("browser config reports Edge Beta family by default", () => {
  const resolved = resolveBrowserConfig("C:/repo", {
    env: { LOCALAPPDATA: "C:/Users/Test/AppData/Local" },
    config: {},
    exists: (file) => /Edge Beta\\Application\\msedge\.exe$/i.test(file),
  });

  assert.equal(resolved.family, "edge-beta");
  assert.equal(resolved.source, "edge-beta-default");
  assert.match(resolved.profile, /Edge Beta\\CodexCdpProfile$/);
});

test("browser config does not silently fallback to Edge stable under strict policy", () => {
  const resolved = resolveBrowserConfig("C:/repo", {
    env: { LOCALAPPDATA: "C:/Users/Test/AppData/Local" },
    config: {
      browser_policy: {
        required_family: "edge-beta",
        allow_fallback_family: false,
        require_cdp: true,
        require_dedicated_profile: true,
      },
    },
    exists: (file) => /Microsoft\\Edge\\Application\\msedge\.exe$/i.test(file),
  });

  assert.equal(resolved.family, "edge-beta");
  assert.equal(resolved.exists, false);
  assert.equal(resolved.policy.required_family, "edge-beta");
  assert.match(resolved.problem, /requires Edge Beta/i);
});
```

Create `test/contracts/no-mcp-fallback.test.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("job-board harness source has no MCP fallback calls", () => {
  const files = [
    "src/cli/runtime.mjs",
    "tools/job_board_harness.mjs",
    "src/config/browser-config.mjs",
  ];
  const text = files.map((file) => fs.readFileSync(path.join(ROOT, file), "utf8")).join("\n");
  assert.doesNotMatch(text, /page-agent|chrome-devtools|playwright-mcp|browser-use|tool_search|mcp__|browser-use/i);
});
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
node --test .\test\contracts\browser-policy.test.mjs .\test\contracts\no-mcp-fallback.test.mjs
```

Expected: `browser-policy.test.mjs` FAILS because `resolveBrowserConfig()` currently does not return `family`, `policy`, or `problem`.

- [ ] **Step 3: Update browser config policy**

Modify `configs/browser.yaml`:

```yaml
browser_exe: null
browser_profile: null
browser_policy:
  required_family: edge-beta
  allow_fallback_family: false
  require_cdp: true
  require_dedicated_profile: true
```

Modify `src/config/browser-config.mjs` so default candidates include `family` and strict policy prevents silent fallback:

```javascript
export const DEFAULT_BROWSER_CANDIDATES = [
  { exe: "C:\\Program Files (x86)\\Microsoft\\Edge Beta\\Application\\msedge.exe", source: "edge-beta-default", family: "edge-beta" },
  { exe: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", source: "edge-stable-default", family: "edge-stable" },
  { exe: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", source: "chrome-default", family: "chrome" },
];

export const DEFAULT_BROWSER_POLICY = {
  required_family: "edge-beta",
  allow_fallback_family: false,
  require_cdp: true,
  require_dedicated_profile: true,
};

export function resolveBrowserConfig(root, {
  env = process.env,
  config = {},
  exists = fs.existsSync,
  candidates = DEFAULT_BROWSER_CANDIDATES,
} = {}) {
  const policy = { ...DEFAULT_BROWSER_POLICY, ...(config.browser_policy || {}) };
  const profile = env.JOB_BOARD_BROWSER_PROFILE || config.browser_profile || defaultBrowserProfile(env);
  const explicitExe = env.JOB_BOARD_BROWSER_EXE || config.browser_exe || null;

  const classify = (exe, source) => {
    const candidate = candidates.find((item) => item.exe.toLowerCase() === String(exe).toLowerCase());
    const family = candidate?.family ||
      (/Edge Beta/i.test(exe) ? "edge-beta" :
        (/Microsoft\\Edge\\Application\\msedge\.exe$/i.test(exe) ? "edge-stable" :
          (/chrome\.exe$/i.test(exe) ? "chrome" : "custom")));
    return { exe, source, family, exists: exists(exe), profile, policy };
  };

  if (explicitExe) {
    const source = env.JOB_BOARD_BROWSER_EXE ? "JOB_BOARD_BROWSER_EXE" : "config.browser_exe";
    const resolved = classify(explicitExe, source);
    if (policy.required_family && resolved.family !== policy.required_family && !policy.allow_fallback_family) {
      return {
        ...resolved,
        exists: false,
        problem: `Browser policy requires Edge Beta (${policy.required_family}); found ${resolved.family} from ${source}.`,
      };
    }
    return resolved;
  }

  const required = candidates.find((item) => item.family === policy.required_family);
  if (required && !policy.allow_fallback_family) {
    const resolved = { ...required, exists: exists(required.exe), profile, policy };
    if (!resolved.exists) {
      return { ...resolved, problem: `Browser policy requires Edge Beta (${policy.required_family}) but executable was not found.` };
    }
    return resolved;
  }

  for (const candidate of candidates) {
    if (exists(candidate.exe)) return { ...candidate, exists: true, profile, policy };
  }
  return { ...candidates[0], exists: false, profile, policy, problem: `Browser executable not found: ${candidates[0].exe}` };
}
```

- [ ] **Step 4: Wire policy into runtime errors**

Modify `src/cli/runtime.mjs` in `startEdgeCdp()`:

```javascript
  if (!browser.exists) {
    throw new Error(browser.problem || `Browser executable not found: ${browser.exe}`);
  }
```

Modify `cmdDoctor()` browser output to include:

```javascript
      family: browser.family,
      policy: browser.policy,
      problem: browser.problem || null,
```

- [ ] **Step 5: Run browser tests**

Run:

```powershell
node --test .\test\contracts\browser-policy.test.mjs .\test\contracts\no-mcp-fallback.test.mjs .\test\unit\browser-config.test.mjs
node .\tools\job_board_harness.mjs doctor
```

Expected:

- Tests PASS.
- `doctor` JSON includes `browser.family: "edge-beta"`, `browser.policy.required_family: "edge-beta"`, and `browser.problem: null` on a machine with Edge Beta.

- [ ] **Step 6: Commit**

```powershell
git add configs\browser.yaml src\config\browser-config.mjs src\cli\runtime.mjs test\contracts\browser-policy.test.mjs test\contracts\no-mcp-fallback.test.mjs
git commit -m "feat: enforce Edge Beta CDP browser policy"
```

## Task 3: Artifact Schemas And Atomic Writes

**Files:**

- Create: `src/artifacts/schemas.ts`
- Create: `src/artifacts/validate.ts`
- Create: `src/artifacts/write.ts`
- Create: `src/artifacts/read.ts`
- Create: `src/artifacts/paths.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Test: `test/contracts/artifact-schema.test.mjs`
- Test: `test/unit/artifact-store.test.mjs`

- [ ] **Step 1: Add TypeScript toolchain scripts**

Modify `package.json`:

```json
{
  "name": "resume-job-board-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "doctor": "node tools/job_board_harness.mjs doctor",
    "test": "node --test tools/job_board_harness.test.mjs tools/github_edge_workflow.test.mjs test/unit/*.test.mjs test/contracts/*.test.mjs test/integration/*.test.mjs",
    "test:unit": "node --test test/unit/*.test.mjs",
    "test:contracts": "node --test test/contracts/*.test.mjs",
    "test:integration": "node --test test/integration/*.test.mjs",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json",
    "verify": "npm run typecheck && npm test && node tools/job_board_harness.mjs doctor"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.9.0"
  }
}
```

Install with China-accessible registry:

```powershell
$env:npm_config_registry = "https://registry.npmmirror.com"
npm install
```

Expected: `package-lock.json` is created and `npm run typecheck` can run. If npm is unavailable, record the blocker and continue with direct `node --test` gates until Node/npm runtime is repaired.

- [ ] **Step 2: Write failing artifact schema tests**

Create `test/contracts/artifact-schema.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import {
  validateArtifactEnvelope,
  validateRunManifest,
} from "../../dist/artifacts/validate.js";

test("artifact envelope requires schema version and producer metadata", () => {
  const valid = validateArtifactEnvelope({
    schema_version: "CandidateCollection.v1",
    created_at: "2026-05-17T00:00:00.000Z",
    producer: "job-board.collect",
    input_artifacts: [],
    meta: {},
    items: [],
  });
  assert.deepEqual(valid.errors, []);

  const invalid = validateArtifactEnvelope({ items: [] });
  assert(invalid.errors.includes("schema_version is required"));
  assert(invalid.errors.includes("created_at is required"));
  assert(invalid.errors.includes("producer is required"));
});

test("run manifest records stage status and recovery metadata", () => {
  const result = validateRunManifest({
    schema_version: "RunManifest.v1",
    created_at: "2026-05-17T00:00:00.000Z",
    producer: "job-board.run",
    input_artifacts: [],
    meta: { run_id: "unit-run" },
    stages: [
      {
        stage: "auth",
        status: "ok",
        exit_code: 0,
        started_at: "2026-05-17T00:00:00.000Z",
        finished_at: "2026-05-17T00:00:01.000Z",
        input_artifacts: [],
        output_artifacts: [],
        warnings: [],
        requires_user_action: false,
        recoverable: true,
        next_action: "",
      },
    ],
  });
  assert.deepEqual(result.errors, []);
});
```

- [ ] **Step 3: Run failing schema tests**

Run:

```powershell
npm run build
node --test .\test\contracts\artifact-schema.test.mjs
```

Expected: FAIL because `src/artifacts/validate.ts` does not exist.

- [ ] **Step 4: Implement schema validators**

Create `src/artifacts/schemas.ts`:

```typescript
export type ArtifactEnvelope<TMeta extends Record<string, unknown> = Record<string, unknown>> = {
  schema_version: string;
  created_at: string;
  producer: string;
  input_artifacts: string[];
  meta: TMeta;
};

export type StageStatus = "pending" | "ok" | "skipped" | "failed" | "blocked";

export type RunStageResult = {
  stage: string;
  status: StageStatus;
  exit_code: number;
  started_at: string;
  finished_at: string;
  input_artifacts: string[];
  output_artifacts: string[];
  warnings: string[];
  requires_user_action: boolean;
  recoverable: boolean;
  next_action: string;
};

export type RunManifest = ArtifactEnvelope<{ run_id: string }> & {
  stages: RunStageResult[];
};
```

Create `src/artifacts/validate.ts`:

```typescript
export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireString(errors: string[], object: Record<string, unknown>, key: string): void {
  if (typeof object[key] !== "string" || String(object[key]).trim() === "") {
    errors.push(`${key} is required`);
  }
}

function requireArray(errors: string[], object: Record<string, unknown>, key: string): void {
  if (!Array.isArray(object[key])) errors.push(`${key} must be a list`);
}

export function validateArtifactEnvelope(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(value)) return { errors: ["artifact must be an object"], warnings: [] };
  requireString(errors, value, "schema_version");
  requireString(errors, value, "created_at");
  requireString(errors, value, "producer");
  requireArray(errors, value, "input_artifacts");
  if (!isObject(value.meta)) errors.push("meta must be an object");
  return { errors, warnings: [] };
}

export function validateRunManifest(value: unknown): ValidationResult {
  const base = validateArtifactEnvelope(value);
  const errors = [...base.errors];
  if (!isObject(value)) return { errors, warnings: base.warnings };
  if (!Array.isArray(value.stages)) {
    errors.push("stages must be a list");
    return { errors, warnings: base.warnings };
  }
  value.stages.forEach((stage, index) => {
    if (!isObject(stage)) {
      errors.push(`stages[${index}] must be an object`);
      return;
    }
    for (const key of ["stage", "status", "started_at", "finished_at", "next_action"]) {
      requireString(errors, stage, `stages[${index}].${key}`);
    }
    for (const key of ["input_artifacts", "output_artifacts", "warnings"]) {
      if (!Array.isArray(stage[key])) errors.push(`stages[${index}].${key} must be a list`);
    }
    if (!Number.isInteger(stage.exit_code)) errors.push(`stages[${index}].exit_code must be an integer`);
    if (typeof stage.requires_user_action !== "boolean") errors.push(`stages[${index}].requires_user_action must be boolean`);
    if (typeof stage.recoverable !== "boolean") errors.push(`stages[${index}].recoverable must be boolean`);
  });
  return { errors, warnings: base.warnings };
}
```

- [ ] **Step 5: Implement atomic artifact writer**

Create `src/artifacts/write.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";

export function writeJsonAtomic(file: string, value: unknown): string {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, file);
  return file;
}
```

Create `src/artifacts/read.ts`:

```typescript
import fs from "node:fs";

export function readJsonFile(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
```

Create `src/artifacts/paths.ts`:

```typescript
import path from "node:path";

export function stateDir(root: string): string {
  return path.resolve(root, ".tmp", "job_board_harness");
}

export function runDir(root: string, runId: string): string {
  return path.join(stateDir(root), "runs", runId);
}
```

- [ ] **Step 6: Write and run artifact store tests**

Create `test/unit/artifact-store.test.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readJsonFile } from "../../dist/artifacts/read.js";
import { writeJsonAtomic } from "../../dist/artifacts/write.js";

test("writeJsonAtomic writes complete JSON and leaves no temp file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "job-board-artifact-"));
  const file = path.join(dir, "artifact.json");
  writeJsonAtomic(file, { schema_version: "Unit.v1", ok: true });

  assert.deepEqual(readJsonFile(file), { schema_version: "Unit.v1", ok: true });
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.endsWith(".tmp")), []);
});
```

Run:

```powershell
npm run build
node --test .\test\contracts\artifact-schema.test.mjs .\test\unit\artifact-store.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json tsconfig.json src\artifacts test\contracts\artifact-schema.test.mjs test\unit\artifact-store.test.mjs
git commit -m "feat: add artifact schemas and atomic writes"
```

## Task 4: Command Result And Exit Code Matrix

**Files:**

- Create: `src/cli/command-result.ts`
- Create: `src/cli/parser.ts`
- Modify: `src/cli/runtime.mjs`
- Test: `test/unit/command-result.test.mjs`
- Test: `test/contracts/exit-code-matrix.test.mjs`

- [ ] **Step 1: Write failing command result tests**

Create `test/unit/command-result.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import {
  exitCodeForStatus,
  makeCommandResult,
} from "../../dist/cli/command-result.js";

test("command result maps statuses to stable exit codes", () => {
  assert.equal(exitCodeForStatus("ok"), 0);
  assert.equal(exitCodeForStatus("environment_unavailable"), 2);
  assert.equal(exitCodeForStatus("user_action_required"), 3);
  assert.equal(exitCodeForStatus("contact_verification_failed"), 4);
  assert.equal(exitCodeForStatus("contract_or_schema_failure"), 5);
});

test("makeCommandResult preserves artifact and recovery metadata", () => {
  const result = makeCommandResult({
    status: "user_action_required",
    artifactPaths: ["C:/repo/.tmp/job_board_harness/auth_status.json"],
    warnings: ["login-required"],
    requiresUserAction: true,
    recoverable: true,
    nextAction: "Finish login in Edge Beta and rerun auth.",
  });

  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 3);
  assert.equal(result.requiresUserAction, true);
  assert.equal(result.recoverable, true);
});
```

Create `test/contracts/exit-code-matrix.test.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("exit code matrix is documented and implemented", async () => {
  const docs = fs.readFileSync(path.join(ROOT, "docs", "harness-contracts.md"), "utf8");
  const mod = await import("../../dist/cli/command-result.js");
  for (const [status, code] of Object.entries({
    ok: 0,
    environment_unavailable: 2,
    user_action_required: 3,
    contact_verification_failed: 4,
    contract_or_schema_failure: 5,
  })) {
    assert.equal(mod.exitCodeForStatus(status), code);
    assert.match(docs, new RegExp(String(code)));
    assert.match(docs, new RegExp(status));
  }
});
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npm run build
node --test .\test\unit\command-result.test.mjs .\test\contracts\exit-code-matrix.test.mjs
```

Expected: FAIL because `src/cli/command-result.ts` does not exist.

- [ ] **Step 3: Implement command result**

Create `src/cli/command-result.ts`:

```typescript
export type CommandStatus =
  | "ok"
  | "environment_unavailable"
  | "user_action_required"
  | "contact_verification_failed"
  | "contract_or_schema_failure";

export type CommandResult = {
  ok: boolean;
  status: CommandStatus;
  exitCode: number;
  artifactPaths: string[];
  warnings: string[];
  requiresUserAction: boolean;
  recoverable: boolean;
  nextAction: string;
  data: Record<string, unknown>;
};

export function exitCodeForStatus(status: string): number {
  switch (status) {
    case "ok": return 0;
    case "environment_unavailable": return 2;
    case "user_action_required": return 3;
    case "contact_verification_failed": return 4;
    case "contract_or_schema_failure": return 5;
    default: return 1;
  }
}

export function makeCommandResult(input: {
  status: CommandStatus;
  artifactPaths?: string[];
  warnings?: string[];
  requiresUserAction?: boolean;
  recoverable?: boolean;
  nextAction?: string;
  data?: Record<string, unknown>;
}): CommandResult {
  const exitCode = exitCodeForStatus(input.status);
  return {
    ok: exitCode === 0,
    status: input.status,
    exitCode,
    artifactPaths: input.artifactPaths || [],
    warnings: input.warnings || [],
    requiresUserAction: Boolean(input.requiresUserAction),
    recoverable: input.recoverable !== false,
    nextAction: input.nextAction || "",
    data: input.data || {},
  };
}
```

- [ ] **Step 4: Run tests**

```powershell
npm run build
node --test .\test\unit\command-result.test.mjs .\test\contracts\exit-code-matrix.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src\cli\command-result.ts test\unit\command-result.test.mjs test\contracts\exit-code-matrix.test.mjs
git commit -m "feat: define command result exit contracts"
```

## Task 5: Pipeline Stage Graph And Run Manifest

**Files:**

- Create: `src/core/pipeline/stage-result.ts`
- Create: `src/core/pipeline/stage-graph.ts`
- Create: `src/core/pipeline/run-pipeline.ts`
- Modify: `src/cli/runtime.mjs`
- Test: `test/contracts/pipeline-contract.test.mjs`
- Test: `test/unit/run-pipeline.test.mjs`

- [ ] **Step 1: Write failing pipeline tests**

Create `test/contracts/pipeline-contract.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");

test("run --fixture dry-run emits the full default pipeline including detail stages", () => {
  const runId = "contract_pipeline_fixture";
  const runDir = path.join(STATE_DIR, "runs", runId);
  fs.rmSync(runDir, { recursive: true, force: true });

  const output = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "run",
    "--profile",
    "ai-agent-dev",
    "--fixture",
    "boss-search-normal",
    "--run-id",
    runId,
    "--dry-run",
  ], { cwd: ROOT, encoding: "utf8" }));

  assert.deepEqual(output.plan, [
    "auth",
    "collect",
    "rank_candidates",
    "extract_details",
    "rank_details",
    "agent_review",
    "select",
    "open_batches",
  ]);

  const manifestFile = path.join(runDir, "run_manifest.json");
  assert(fs.existsSync(manifestFile));
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  assert.equal(manifest.schema_version, "RunManifest.v1");
  assert.deepEqual(manifest.stages.map((stage) => stage.stage), output.plan);
});
```

Create `test/unit/run-pipeline.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { defaultRunStageGraph } from "../../dist/core/pipeline/stage-graph.js";

test("default run stage graph contains detail enrichment before agent review", () => {
  assert.deepEqual(defaultRunStageGraph({ skipDetails: false }), [
    "auth",
    "collect",
    "rank_candidates",
    "extract_details",
    "rank_details",
    "agent_review",
    "select",
    "open_batches",
  ]);
});

test("skip details is explicit and visible in the stage graph", () => {
  assert.deepEqual(defaultRunStageGraph({ skipDetails: true }), [
    "auth",
    "collect",
    "rank_candidates",
    "extract_details_skipped",
    "rank_details_skipped",
    "agent_review",
    "select",
    "open_batches",
  ]);
});
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npm run build
node --test .\test\unit\run-pipeline.test.mjs .\test\contracts\pipeline-contract.test.mjs
```

Expected: FAIL because pipeline modules do not exist and current `run` plan lacks detail stages.

- [ ] **Step 3: Implement stage graph**

Create `src/core/pipeline/stage-graph.ts`:

```typescript
export type RunStageName =
  | "auth"
  | "collect"
  | "rank_candidates"
  | "extract_details"
  | "extract_details_skipped"
  | "rank_details"
  | "rank_details_skipped"
  | "agent_review"
  | "select"
  | "open_batches";

export function defaultRunStageGraph({ skipDetails = false }: { skipDetails?: boolean } = {}): RunStageName[] {
  return [
    "auth",
    "collect",
    "rank_candidates",
    skipDetails ? "extract_details_skipped" : "extract_details",
    skipDetails ? "rank_details_skipped" : "rank_details",
    "agent_review",
    "select",
    "open_batches",
  ];
}
```

Create `src/core/pipeline/stage-result.ts`:

```typescript
import type { RunStageResult } from "../../artifacts/schemas.js";

export function makeStageResult(input: Partial<RunStageResult> & { stage: string }): RunStageResult {
  const now = new Date().toISOString();
  return {
    stage: input.stage,
    status: input.status || "pending",
    exit_code: input.exit_code ?? 0,
    started_at: input.started_at || now,
    finished_at: input.finished_at || now,
    input_artifacts: input.input_artifacts || [],
    output_artifacts: input.output_artifacts || [],
    warnings: input.warnings || [],
    requires_user_action: Boolean(input.requires_user_action),
    recoverable: input.recoverable !== false,
    next_action: input.next_action || "",
  };
}
```

- [ ] **Step 4: Adapt current `cmdRun()` without full use-case migration**

Modify `src/cli/runtime.mjs`:

- Import `defaultRunStageGraph` from built JS only after build cutover, or keep a temporary local constant in `runtime.mjs` matching the same array.
- In `cmdRun()`, change `plan` to:

```javascript
  const skipDetails = boolOption(args, "skip-details");
  const plan = [
    "auth",
    "collect",
    "rank_candidates",
    skipDetails ? "extract_details_skipped" : "extract_details",
    skipDetails ? "rank_details_skipped" : "rank_details",
    "agent_review",
    "select",
    "open_batches",
  ];
```

- Write `run_manifest.json` at run creation with stage entries, even in dry-run and fixture mode.
- In fixture mode, write `details.json` from fixture detail extraction when fixture detail exists; if fixture detail is not available, mark `extract_details` as `skipped` with `next_action: "No matching detail fixture for this static run."`.

Use this manifest shape:

```javascript
  writeJson(path.join(runDir, "run_manifest.json"), {
    schema_version: "RunManifest.v1",
    created_at: new Date().toISOString(),
    producer: "job-board.run",
    input_artifacts: [path.join(runDir, "input.json")],
    meta: { run_id: runId, profile: profile.id, site },
    stages: plan.map((stage) => ({
      stage,
      status: boolOption(args, "dry-run") ? "skipped" : "pending",
      exit_code: 0,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      input_artifacts: [],
      output_artifacts: [],
      warnings: [],
      requires_user_action: false,
      recoverable: true,
      next_action: boolOption(args, "dry-run") ? "Run without --dry-run to execute this stage." : "",
    })),
  });
```

- [ ] **Step 5: Run pipeline tests**

Run:

```powershell
npm run build
node --test .\test\unit\run-pipeline.test.mjs .\test\contracts\pipeline-contract.test.mjs
node --test .\test\unit\fixture-workflow.test.mjs .\test\unit\remaining-architecture.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src\core\pipeline src\cli\runtime.mjs test\contracts\pipeline-contract.test.mjs test\unit\run-pipeline.test.mjs
git commit -m "feat: define run pipeline stage graph"
```

## Task 6: Replace Child-Process Self-Orchestration With Use Cases

**Files:**

- Create: `src/core/use-cases/collect-candidates.ts`
- Create: `src/core/use-cases/rank-candidates.ts`
- Create: `src/core/use-cases/extract-details.ts`
- Create: `src/core/use-cases/build-agent-review.ts`
- Create: `src/core/use-cases/select-candidates.ts`
- Create: `src/core/use-cases/open-queue.ts`
- Modify: `src/core/pipeline/run-pipeline.ts`
- Modify: `src/cli/runtime.mjs`
- Test: `test/integration/fixture-pipeline.test.mjs`

- [ ] **Step 1: Write failing integration test**

Create `test/integration/fixture-pipeline.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");

test("fixture run writes candidate, ranked, detail, review, selection, queue, and manifest artifacts", () => {
  const runId = "integration_fixture_pipeline";
  const runDir = path.join(STATE_DIR, "runs", runId);
  fs.rmSync(runDir, { recursive: true, force: true });

  const result = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "run",
    "--profile",
    "ai-agent-dev",
    "--fixture",
    "boss-search-normal",
    "--run-id",
    runId,
    "--dry-run",
  ], { cwd: ROOT, encoding: "utf8" }));

  assert.equal(result.run_id, runId);
  for (const name of [
    "input.json",
    "run_manifest.json",
    "candidates.json",
    "ranked.json",
    "details.json",
    "ranked_details.json",
    "agent_review.json",
    "selection.json",
    "open_queue.json",
    "summary.md",
  ]) {
    assert(fs.existsSync(path.join(runDir, name)), `${name} should exist`);
  }
});
```

- [ ] **Step 2: Run failing integration test**

```powershell
node --test .\test\integration\fixture-pipeline.test.mjs
```

Expected: FAIL because current fixture `run` does not write `details.json` and `ranked_details.json`.

- [ ] **Step 3: Extract fixture use cases from runtime**

Create each use case as a thin typed wrapper around existing module functions first:

`src/core/use-cases/rank-candidates.ts`:

```typescript
import { scoreRecord } from "../../rank/keyword-ranker.mjs";

export function rankCandidates(records: Record<string, unknown>[], context: Record<string, unknown> = {}) {
  return records
    .map((record) => ({ ...record, ...scoreRecord(record, context) }))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}
```

`src/core/use-cases/build-agent-review.ts`:

```typescript
import { buildAgentReview } from "../../agent/review-runner.mjs";

export function buildAgentReviewUseCase(input: Record<string, unknown>, options: Record<string, unknown> = {}) {
  return buildAgentReview(input, options);
}
```

`src/core/use-cases/select-candidates.ts`:

```typescript
import { selectedRecordsFromReview } from "../../agent/review-runner.mjs";

export function selectCandidates(review: Record<string, unknown>) {
  return selectedRecordsFromReview(review);
}
```

- [ ] **Step 4: Refactor fixture pipeline first**

Modify `cmdRun()` fixture branch so it no longer delegates entirely through `runChildJson(["test-fixture", ...])`. It should directly:

1. Read fixture HTML through existing `fixtureInfo()`.
2. Extract candidates through existing `extractJobCardsFromHtml()`.
3. Rank candidates.
4. Extract detail fixtures through existing `extractFixtureDetails()`.
5. Rank details.
6. Build agent review from `ranked_details` if non-empty, otherwise from `ranked`.
7. Select candidates.
8. Create open queue.
9. Write `run_manifest.json` and `summary.md`.

Keep current `test-fixture` command working; this task only changes `run --fixture`.

- [ ] **Step 5: Run targeted tests**

```powershell
node --test .\test\integration\fixture-pipeline.test.mjs .\test\unit\fixture-workflow.test.mjs .\test\unit\remaining-architecture.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src\core\use-cases src\cli\runtime.mjs test\integration\fixture-pipeline.test.mjs
git commit -m "feat: run fixture pipeline through use cases"
```

## Task 7: State Store, Open Ledger, And Recovery Tests

**Files:**

- Create: `src/state/open-ledger.ts`
- Create: `src/state/run-store.ts`
- Create: `src/state/queue-store.ts`
- Modify: `src/state/opened-state.mjs`
- Modify: `src/cli/runtime.mjs`
- Test: `test/unit/open-ledger.test.mjs`
- Test: `test/integration/state-recovery.test.mjs`

- [ ] **Step 1: Write failing ledger tests**

Create `test/unit/open-ledger.test.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  appendOpenLedgerEvent,
  loadOpenLedger,
} from "../../dist/state/open-ledger.js";

test("open ledger appends JSONL events and loads by identity key", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "job-board-ledger-"));
  const file = path.join(dir, "open-ledger.jsonl");

  appendOpenLedgerEvent(file, {
    schema_version: "OpenLedgerEvent.v1",
    created_at: "2026-05-17T00:00:00.000Z",
    action: "opened",
    identity_keys: ["boss:abc", "sig:ai agent engineer|future ai|shenzhen"],
    record: { id: "abc", url: "https://www.zhipin.com/job_detail/abc.html" },
    source_artifact: "selection.json",
  });

  const ledger = loadOpenLedger(file);
  assert.equal(ledger.events.length, 1);
  assert.equal(ledger.keys.has("boss:abc"), true);
  assert.equal(ledger.keys.has("sig:ai agent engineer|future ai|shenzhen"), true);
});
```

Create `test/integration/state-recovery.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const HARNESS = path.join(ROOT, "tools", "job_board_harness.mjs");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");

test("open-batches resume rechecks ledger keys and marks duplicates as opened", () => {
  const stateDir = fs.mkdtempSync(path.join(STATE_DIR, "ledger_recovery_"));
  const queueFile = path.join(stateDir, "queue.json");
  const ledgerFile = path.join(stateDir, "open-ledger.jsonl");

  fs.writeFileSync(ledgerFile, JSON.stringify({
    schema_version: "OpenLedgerEvent.v1",
    created_at: "2026-05-17T00:00:00.000Z",
    action: "opened",
    identity_keys: ["sig:senior ai agent engineer|future ai|shenzhen"],
    record: { title: "Senior AI Agent Engineer", company: "Future AI", location: "Shenzhen" },
    source_artifact: "opened.json",
  }) + "\n", "utf8");

  fs.writeFileSync(queueFile, JSON.stringify({
    queue_id: "ledger-recovery",
    status: "pending",
    reason: "",
    created_at: "2026-05-17T00:00:00.000Z",
    updated_at: "2026-05-17T00:00:00.000Z",
    max_per_batch: 15,
    cooldown_ms: 0,
    jitter_ms: 0,
    stop_on_access_limited: true,
    cursor: 0,
    total: 1,
    opened: 0,
    failed: 0,
    remaining: 1,
    items: [{
      index: 0,
      status: "pending",
      opened_at: null,
      error: null,
      record: {
        id: "duplicate",
        site: "boss",
        title: "Senior AI Agent Engineer",
        company: "Future AI",
        location: "Shenzhen",
        url: "https://www.zhipin.com/job_detail/duplicate.html"
      }
    }],
    receipts: []
  }, null, 2), "utf8");

  const out = JSON.parse(execFileSync(process.execPath, [
    HARNESS,
    "open-batches",
    "--resume",
    "--queue",
    queueFile,
    "--dry-run",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, JOB_BOARD_HARNESS_STATE_DIR: stateDir },
  }));

  assert.equal(out.queue.remaining, 0);
  assert.equal(out.rejected[0].skipReason, "already-opened");
});
```

- [ ] **Step 2: Implement ledger**

Create `src/state/open-ledger.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";

export type OpenLedgerEvent = {
  schema_version: "OpenLedgerEvent.v1";
  created_at: string;
  action: "opened" | "skipped" | "failed" | "contact_verified" | "access_limited";
  identity_keys: string[];
  record: Record<string, unknown>;
  source_artifact: string;
};

export function appendOpenLedgerEvent(file: string, event: OpenLedgerEvent): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(event)}\n`, "utf8");
}

export function loadOpenLedger(file: string): { events: OpenLedgerEvent[]; keys: Set<string> } {
  const events: OpenLedgerEvent[] = [];
  const keys = new Set<string>();
  if (!fs.existsSync(file)) return { events, keys };
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const event = JSON.parse(line) as OpenLedgerEvent;
    events.push(event);
    for (const key of event.identity_keys || []) keys.add(key);
  }
  return { events, keys };
}
```

- [ ] **Step 3: Bridge ledger into existing opened state**

Modify `src/state/opened-state.mjs`:

- Add optional loading from `.tmp/job_board_harness/open-ledger.jsonl`.
- For each ledger event, add `identity_keys` into `state.keys`.
- Keep existing `opened_ids.txt`, `opened_urls.txt`, `opened_keys.txt` compatibility.

- [ ] **Step 4: Run recovery tests**

```powershell
npm run build
node --test .\test\unit\open-ledger.test.mjs .\test\integration\state-recovery.test.mjs .\test\unit\opened-state.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src\state\open-ledger.ts src\state\opened-state.mjs test\unit\open-ledger.test.mjs test\integration\state-recovery.test.mjs
git commit -m "feat: add open ledger state recovery"
```

## Task 8: Agent Judgment V2 Prompt Contract

**Files:**

- Modify: `src/agent/prompt-contracts.mjs`
- Modify: `src/agent/review-runner.mjs`
- Modify: `docs/codex-agent-workflow.md`
- Test: `test/unit/agent-contracts.test.mjs`

- [ ] **Step 1: Add failing tests for richer judgment output**

Modify `test/unit/agent-contracts.test.mjs` by adding:

```javascript
test("agent review request supports richer judgment without execution authority", () => {
  const request = buildAgentReviewRequest({
    profile: { id: "ai-agent-dev", review_policy: { codex_review_top_n: 2, codex_review_borderline_n: 1 } },
    resume_summary: "AI Agent / RAG",
    user_need: "AI Agent platform",
    ranked: [{
      id: "candidate-1",
      title: "AI Agent Engineer",
      score: 72,
      explain: { matched: [{ term: "AI Agent" }], negative: [], hard_filters: [] },
    }],
  });

  assert(request.output_contract.decisions.includes("needs_more_info"));
  assert(request.output_contract.selection_item_required_fields.includes("fit_summary"));
  assert(request.output_contract.selection_item_optional_fields.includes("missing_information"));
  assert.equal(request.guardrails.no_external_actions, true);
});

test("validateAgentReviewOutput accepts needs_more_info advice and rejects execution directives", () => {
  const valid = validateAgentReviewOutput({
    selection: [{
      id: "candidate-1",
      decision: "needs_more_info",
      priority: "medium",
      confidence: "medium",
      fit_summary: "Good AI Agent overlap but salary is missing.",
      reason: "Evidence is thin.",
      risk: "salary unknown",
      matched_evidence: ["AI Agent"],
      risk_flags: ["thin_description"],
      missing_information: ["salary floor"],
      suggested_user_question: "请确认薪资下限和团队方向。",
    }],
  }, { allowedIds: ["candidate-1"] });
  assert.deepEqual(valid.errors, []);

  const invalid = validateAgentReviewOutput({
    selection: [{
      id: "candidate-1",
      decision: "select",
      confidence: "high",
      reason: "open the browser tab and send message now",
      risk: "none",
      candidate: { id: "candidate-1" },
    }],
  }, { allowedIds: ["candidate-1"] });
  assert(invalid.errors.some((error) => /must not request/i.test(error)));
});
```

- [ ] **Step 2: Run failing test**

```powershell
node --test .\test\unit\agent-contracts.test.mjs
```

Expected: FAIL because current contract decisions do not include `needs_more_info`.

- [ ] **Step 3: Update prompt contract**

Modify `src/agent/prompt-contracts.mjs`:

- Add `needs_more_info` to decisions.
- Add required fields:
  - `fit_summary`
  - `matched_evidence`
  - `risk_flags`
- Add optional fields:
  - `missing_information`
  - `suggested_user_question`
  - `profile_patch_suggestion`
- Add guardrail:
  - `no_external_actions: true`

Keep existing forbidden action validator and expand it with Chinese and English patterns for:

- open tabs
- trigger contact
- send message
- apply to jobs
- export credentials/cookies

- [ ] **Step 4: Update review runner default output**

Modify `src/agent/review-runner.mjs` so auto-generated review records include:

```javascript
fit_summary: decision.reason,
matched_evidence: reviewEvidenceTerms(normalized),
risk_flags: reviewNegativeTerms(normalized).length ? ["negative_terms"] : [],
missing_information: normalized.salary ? [] : ["salary"],
suggested_user_question: normalized.salary ? "" : "请打开详情页确认薪资范围和团队方向。",
```

- [ ] **Step 5: Run agent tests**

```powershell
node --test .\test\unit\agent-contracts.test.mjs .\test\unit\job-board-architecture-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src\agent\prompt-contracts.mjs src\agent\review-runner.mjs docs\codex-agent-workflow.md test\unit\agent-contracts.test.mjs
git commit -m "feat: expand agent judgment contract"
```

## Task 9: Site Adapter Contract Completion

**Files:**

- Create: `src/sites/site-adapter.ts`
- Modify: `src/sites/boss.mjs`
- Modify: `src/sites/liepin.mjs`
- Modify: `src/sites/job51.mjs`
- Modify: `src/sites/registry.mjs`
- Modify: `src/cli/runtime.mjs`
- Test: `test/unit/site-adapter-contract.test.mjs`
- Test: `test/unit/site-adapters.test.mjs`

- [ ] **Step 1: Write failing site adapter contract test**

Create `test/unit/site-adapter-contract.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { listSiteAdapters } from "../../src/sites/registry.mjs";

test("every site adapter owns URL, auth, collect, detail, and access-limit contracts", () => {
  for (const adapter of listSiteAdapters()) {
    assert.equal(typeof adapter.id, "string");
    assert.equal(typeof adapter.canonicalize, "function", `${adapter.id}.canonicalize`);
    assert.equal(typeof adapter.isSearchPage, "function", `${adapter.id}.isSearchPage`);
    assert.equal(typeof adapter.detectAccessLimited, "function", `${adapter.id}.detectAccessLimited`);
    assert.equal(typeof adapter.buildCollectExpression, "function", `${adapter.id}.buildCollectExpression`);
    assert.equal(typeof adapter.buildDetailExpression, "function", `${adapter.id}.buildDetailExpression`);
    assert.equal(typeof adapter.buildAuthProbeExpression, "function", `${adapter.id}.buildAuthProbeExpression`);
  }
});
```

- [ ] **Step 2: Run failing test**

```powershell
node --test .\test\unit\site-adapter-contract.test.mjs
```

Expected: FAIL because current adapters do not expose all required functions.

- [ ] **Step 3: Add adapter interface documentation**

Create `src/sites/site-adapter.ts`:

```typescript
export type SiteAdapter = {
  id: string;
  hostPatterns: RegExp[];
  canonicalize(input: string): { site: string; id: string; url: string } | null;
  isSearchPage(input: string): boolean;
  detectAccessLimited(htmlOrText: string, url?: string): boolean;
  buildCollectExpression(site?: string): string;
  buildDetailExpression(): string;
  buildAuthProbeExpression(): string;
};
```

- [ ] **Step 4: Move expression builders from runtime into adapters**

Move logic from `src/cli/runtime.mjs`:

- `extractionExpression(site)` -> adapter `buildCollectExpression()`
- `detailPageExpression()` -> adapter `buildDetailExpression()`
- `authExpression()` plus site URL metadata -> adapter `buildAuthProbeExpression()`
- access-limit detection -> adapter `detectAccessLimited()`

Keep temporary forwarding functions in `runtime.mjs`:

```javascript
function extractionExpression(site) {
  const adapter = getSiteAdapter(site);
  return adapter ? adapter.buildCollectExpression(site) : legacyExtractionExpression(site);
}
```

Remove `legacyExtractionExpression` only after all tests pass and no call sites depend on old mixed-site expression.

- [ ] **Step 5: Run adapter tests**

```powershell
node --test .\test\unit\site-adapter-contract.test.mjs .\test\unit\site-adapters.test.mjs .\test\unit\fixture-workflow.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src\sites src\cli\runtime.mjs test\unit\site-adapter-contract.test.mjs
git commit -m "feat: complete site adapter contracts"
```

## Task 10: Runtime Decomposition Gate

**Files:**

- Modify: `src/cli/runtime.mjs`
- Modify: `src/cli/index.ts`
- Modify: `src/cli/commands/*.ts`
- Modify: `src/cli/legacy-harness.ts`
- Test: `test/contracts/runtime-decomposition.test.mjs`

- [ ] **Step 1: Write failing decomposition tests**

Create `test/contracts/runtime-decomposition.test.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("runtime is no longer the business logic center", () => {
  const runtime = fs.readFileSync(path.join(ROOT, "src", "cli", "runtime.mjs"), "utf8");
  const lineCount = runtime.split(/\r?\n/).length;
  assert(lineCount <= 250, `runtime.mjs has ${lineCount} lines`);
  assert.doesNotMatch(runtime, /function extractionExpression|function authExpression|function detailPageExpression|function scoreRecord/);
});

test("typed CLI commands do not call legacy harness", () => {
  const dir = path.join(ROOT, "src", "cli", "commands");
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith(".ts"))) {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    assert.doesNotMatch(text, /runLegacyHarness|legacy-harness/i, `${name} still calls legacy harness`);
  }
});
```

- [ ] **Step 2: Run failing decomposition tests**

```powershell
node --test .\test\contracts\runtime-decomposition.test.mjs
```

Expected: FAIL until runtime is reduced and command controllers stop calling legacy harness.

- [ ] **Step 3: Implement real CLI main and controllers**

Create `src/cli/main.ts`:

```typescript
import { makeCommandResult, type CommandResult } from "./command-result.js";
import { run as runDoctor } from "./commands/doctor.js";
import { run as runPipeline } from "./commands/run.js";

type CommandHandler = (args: string[]) => Promise<CommandResult> | CommandResult;

const COMMANDS: Record<string, CommandHandler> = {
  doctor: runDoctor,
  run: runPipeline,
};

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command = "help", ...args] = argv;
  const handler = COMMANDS[command];
  if (!handler) {
    const result = makeCommandResult({
      status: "contract_or_schema_failure",
      warnings: [`Unknown command: ${command}`],
      recoverable: true,
      nextAction: "Run job-board help.",
    });
    console.error(JSON.stringify(result, null, 2));
    return result.exitCode;
  }
  const result = await handler(args);
  console.log(JSON.stringify(result.data || result, null, 2));
  return result.exitCode;
}
```

Gradually move all commands from `runtime.mjs` into typed command controllers. Do not delete `runtime.mjs` until all commands are moved and existing tests pass.

- [ ] **Step 4: Switch wrapper after parity**

Modify `tools/job_board_harness.mjs` only after `npm run build` creates `dist/cli/main.js`:

```javascript
#!/usr/bin/env node
import { main } from "../dist/cli/main.js";

main(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
}).catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Run full parity suite**

```powershell
npm run build
node --test .\test\contracts\runtime-decomposition.test.mjs
node --test .\tools\job_board_harness.test.mjs .\tools\github_edge_workflow.test.mjs .\test\unit\*.test.mjs .\test\contracts\*.test.mjs .\test\integration\*.test.mjs
node .\tools\job_board_harness.mjs doctor
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add tools\job_board_harness.mjs src\cli src\core src\browser src\artifacts src\state test\contracts\runtime-decomposition.test.mjs
git commit -m "refactor: move harness commands out of runtime"
```

## Task 11: Final Documentation And Skill Governance

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/config-schema.md`
- Modify: `docs/browser-automation-stack.md`
- Modify: `docs/job-board-ai-workflow.md`
- Modify: `docs/codex-local-tooling.md`
- Modify: `skills/job-board-page-opener/SKILL.md`
- Modify: `skills/job-keyword-profile-review/SKILL.md`
- Modify: `skills/job-selection-review/SKILL.md`
- Modify: `skills/job-feedback-update/SKILL.md`
- Test: `test/contracts/harness-contracts.test.mjs`

- [ ] **Step 1: Update docs to match implemented behavior**

Required documentation facts:

- `run --profile` default pipeline includes detail extraction and second ranking.
- Edge Beta CDP is default and required for job-board live mode.
- MCP/browser tools are inspection-only and not fallback.
- Artifacts have `schema_version`.
- `RunManifest` is the stage audit source.
- `open-ledger.jsonl` is the durable opened-state event source.
- Typecheck is part of verification.
- Live CDP smoke is optional and must not export credentials.

- [ ] **Step 2: Update project-local skills**

In `skills/job-board-page-opener/SKILL.md`, add an operational rule:

```markdown
Use the project harness first for BOSS/Liepin/51job job screening. Do not use chrome-devtools, page-agent, Browser plugin, OS open, or Playwright-managed browsers as fallback for collect/open/open-batches. Those tools are inspection-only unless the user explicitly asks for one-off diagnosis.
```

In `skills/job-selection-review/SKILL.md`, add:

```markdown
Model review may return select, reject, borderline, or needs_more_info. It may suggest user questions and profile patch ideas, but must not ask the harness to open tabs, trigger contact, send messages, apply to jobs, or export credentials.
```

In `skills/job-keyword-profile-review/SKILL.md`, add:

```markdown
Profile patch suggestions are advisory until the user confirms and `profile apply-patch` validates the patch.
```

In `skills/job-feedback-update/SKILL.md`, add:

```markdown
Feedback updates must reference local artifact paths and redacted evidence only.
```

- [ ] **Step 3: Run docs and contract tests**

```powershell
npm run build
node --test .\test\contracts\harness-contracts.test.mjs .\test\contracts\no-mcp-fallback.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add README.md docs skills test\contracts\harness-contracts.test.mjs
git commit -m "docs: align harness workflow and skills"
```

## Final Verification Route

Run this full route before claiming completion:

```powershell
git status --short --branch
npm run build
npm run typecheck
node --check .\tools\job_board_harness.mjs
node --test .\tools\job_board_harness.test.mjs .\tools\github_edge_workflow.test.mjs .\test\unit\*.test.mjs .\test\contracts\*.test.mjs .\test\integration\*.test.mjs
node .\tools\job_board_harness.mjs doctor
node .\tools\job_board_harness.mjs run --profile ai-agent-dev --fixture boss-search-normal --run-id final_verify_fixture --dry-run
node .\tools\job_board_harness.mjs open-batches --queue .\.tmp\job_board_harness\runs\final_verify_fixture\open_queue.json --dry-run
git status --short --branch
```

Expected:

- Build and typecheck pass.
- All automated tests pass.
- `doctor` reports Edge Beta policy and no browser problem on machines with Edge Beta installed.
- Fixture run writes `run_manifest.json`, `details.json`, `ranked_details.json`, `agent_review.json`, `selection.json`, and `open_queue.json`.
- Dry-run open-batches does not open browser tabs.
- No tracked secret or credential files are created.

Optional live verification, only with user authorization:

```powershell
.\tools\job-board.cmd start-browser
.\tools\job-board.cmd auth --site both --open-login
.\tools\job-board.cmd diagnose
```

Pass criteria:

- Edge Beta CDP is available on localhost.
- Required site auth returns `logged-in` or `probably-logged-in`.
- No cookie/password/token values are printed or written.

## Self-Review Checklist

- Spec coverage: The plan covers architecture decomposition, Edge Beta-only browser policy, no MCP fallback, prompt/model task boundaries, artifact schemas, state recovery, TypeScript command migration, docs, skills, and final verification.
- Placeholder scan: Mechanical red-flag search is clean; each task names concrete files, commands, expected failures, and expected passes.
- Type consistency: `CommandResult`, `RunManifest`, `RunStageResult`, `OpenLedgerEvent`, `EdgeBetaCdp`, `needs_more_info`, and stage names are used consistently.
- Security boundary: The plan keeps credential and cookie protection intact and does not require writing real secrets to the repository.
- Tooling governance: Current conclusion is to update existing project-local skills and docs; no new MCP server is needed for this refactor.

## Execution Recommendation

Recommended execution mode is Subagent-Driven after this plan is accepted:

- Worker 1 owns docs/contracts and browser policy.
- Worker 2 owns artifact schemas and command result contracts.
- Worker 3 owns pipeline/use-case extraction.
- Worker 4 owns state ledger/recovery.
- Worker 5 owns agent contract and site adapter completion.

Each worker must edit disjoint files, run its targeted tests, and report changed file paths. The main thread owns integration, full verification, and final docs/skills governance.
