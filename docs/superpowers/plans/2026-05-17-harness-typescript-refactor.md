# Harness TypeScript Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 job-board harness 从 `src/cli/runtime.mjs` 巨型运行时渐进重构为 TypeScript 严格类型、强契约、可测试、可恢复、可审计的本地招聘工作流引擎。

**Architecture:** 保持 `tools/job_board_harness.mjs` 为兼容入口，逐步切到 `dist/cli/main.js -> typed command handler -> use case -> ports/adapters -> artifact/state store`。招聘 live 主流程只使用 Edge Beta CDP profile，不自动回退到 MCP、Browser plugin、OS open 或 Playwright-managed browser；模型只做 job-fit judgment 和建议，不执行外部动作。

**Tech Stack:** Node.js ESM, TypeScript `strict` + `NodeNext`, Node built-in test runner, Edge Beta CDP, local JSON/JSONL artifacts, `zod` for runtime schema validation, `yaml` for config parsing, optional `commander` for CLI parsing after typed handlers 接管。

---

## 当前校准结果

本计划基于 `C:\Users\Administration\CodexWorkspaces\work_jianli\.tmp\harness_typescript_refactor_plan_20260517.md`、当前仓库文件和一次只读 live smoke 校准。

Observed on 2026-05-17:

- `npm test` 通过：77 tests pass。
- `npx tsc --noEmit` 失败，因为项目未安装 `typescript`，`npx` 拉到了错误的 `tsc@2.0.4` 包。
- `package.json` 当前没有 `build`、`typecheck`、`verify` scripts，也没有 `devDependencies`。
- `tsconfig.json` 已启用 `strict`、`NodeNext`、`ES2022`，`rootDir` 为 `src`，`outDir` 为 `dist`。
- `tools/job_board_harness.mjs` 当前直接 import `../src/cli/runtime.mjs`。
- `src/cli/index.ts` 和 `src/cli/commands/*.ts` 当前全部经 `runLegacyHarness()` 回调 `tools/job_board_harness.mjs`，尚未承载业务逻辑。
- `src/cli/runtime.mjs` 当前约 3600 行，包含 CLI parsing、CDP、auth、collection、ranking、details、queue、feedback、profile、pipeline 等事实主逻辑。
- Edge Beta CDP live smoke 通过：Node `v24.15.0`，Edge Beta executable 存在，profile 为 `%LOCALAPPDATA%\Microsoft\Edge Beta\CodexCdpProfile`，CDP port `9222` 可用，browser version `Edg/149.0.4022.8`。
- `auth --site both --reuse-page --no-open-login` 通过：BOSS 与猎聘均识别为 logged-in，未触发 access limit。
- 只读 live `collect --site both --reuse-auth-page --no-open-login` 采集到 27 条记录、4 个页面，未触发 access limit。
- live `rank --profile ai-agent-dev` 对这 27 条全部拒绝，说明 live smoke 的成功标准应分为“采集连通性成功”和“画像匹配质量需要单独评估”，不能要求 selected_count 必须大于 0。
- fixture `test-fixture --fixture boss-search-normal --profile ai-agent-dev --dry-run` 正常生成 candidates、ranked、agent_review、selection、open_queue、summary，且未打开浏览器。

## Non-Negotiables

- 不提交真实 cookie、token、密码、浏览器 profile、API key、SSH key 或外部登录凭据。
- `.tmp/job_board_harness` 继续作为 ignored runtime state，不纳入 Git。
- job-board live 主链路默认只允许 Edge Beta CDP profile。
- Edge Beta CDP 不可用时返回 typed error，不自动切换到 MCP、Browser plugin、OS open、Chrome DevTools、page-agent 或 Playwright-managed browser。
- `open-batches`、`open`、`--trigger-contact` 只有用户明确授权时才执行真实外部动作。
- prompt/model 输出只能做判断和建议，不能要求打开页面、触发沟通、发送消息、投递岗位、导出凭据或修改配置。
- 每个迁移单元先写测试，再做最小实现，再跑 targeted tests、`npm test`、`npm run typecheck`。

## Target File Structure

Create:

```text
src/cli/main.ts
src/cli/parser.ts
src/cli/command-result.ts
src/cli/errors.ts
src/core/use-cases/doctor.ts
src/core/use-cases/auth-check.ts
src/core/use-cases/collect-candidates.ts
src/core/use-cases/rank-candidates.ts
src/core/use-cases/extract-details.ts
src/core/use-cases/build-agent-review.ts
src/core/use-cases/select-candidates.ts
src/core/use-cases/open-batches.ts
src/core/use-cases/record-feedback.ts
src/core/pipeline/stage-graph.ts
src/core/pipeline/stage-result.ts
src/core/pipeline/run-pipeline.ts
src/browser/browser-port.ts
src/browser/browser-policy.ts
src/browser/browser-config.ts
src/browser/cdp-session.ts
src/browser/edge-beta-cdp-browser.ts
src/browser/target-repository.ts
src/browser/page-evaluator.ts
src/browser/tab-opener.ts
src/browser/access-limit-inspector.ts
src/artifacts/artifact-types.ts
src/artifacts/schemas.ts
src/artifacts/validate.ts
src/artifacts/read.ts
src/artifacts/write.ts
src/artifacts/paths.ts
src/artifacts/migrations.ts
src/state/state-types.ts
src/state/run-store.ts
src/state/open-ledger.ts
src/state/queue-store.ts
src/sites/adapter-contract.ts
src/security/redaction-policy.ts
src/security/prompt-injection-policy.ts
```

Modify:

```text
package.json
tsconfig.json
tools/job_board_harness.mjs
src/cli/index.ts
src/cli/legacy-harness.ts
src/cli/runtime.mjs
src/cli/commands/*.ts
src/config/simple-yaml.mjs
src/config/load-config.mjs
src/config/browser-config.mjs
src/sites/boss.mjs
src/sites/liepin.mjs
src/sites/job51.mjs
src/sites/registry.mjs
src/agent/prompt-contracts.mjs
src/agent/review-runner.mjs
src/state/opened-state.mjs
src/batch/queue.mjs
docs/architecture.md
docs/testing.md
docs/browser-automation-stack.md
docs/harness-contracts.md
docs/codex-local-tooling.md
```

Keep during migration:

```text
tools/job_board_harness.mjs
src/cli/runtime.mjs
src/cli/legacy-harness.ts
```

Delete only after parity:

```text
src/cli/runtime.mjs
src/cli/legacy-harness.ts
```

## Migration Order

Migrate low-risk pure logic before live browser logic:

1. Toolchain and result contracts.
2. Artifact schemas and atomic stores.
3. Config parsing and browser policy.
4. Pure use cases: `rank`, `agent-review --prepare`, `select`, `feedback/profile`.
5. Browser port and live-safe use cases: `doctor`, `auth`, `collect`, `extract-details`.
6. Queue/state use cases: `open`, `open-batches`, `opened`, `resume`, `cleanup-pages`.
7. `run` stage graph orchestrator.
8. Runtime shrink/delete and docs/skills governance.

## Task 1: Establish TypeScript Toolchain Gates

**Files:**

- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `test/contracts/typescript-toolchain.test.mjs`

- [ ] **Step 1: Write failing toolchain contract test**

Create `test/contracts/typescript-toolchain.test.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("package exposes build, typecheck, contract, and verify scripts", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.type, "module");
  assert.equal(pkg.scripts.build, "tsc -p tsconfig.json");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit -p tsconfig.json");
  assert.match(pkg.scripts.test, /test\/contracts\/\*\.test\.mjs/);
  assert.equal(pkg.scripts.verify, "npm run typecheck && npm test");
  assert.match(pkg.devDependencies.typescript, /^\^5\./);
  assert.match(pkg.devDependencies["@types/node"], /^\^24\./);
});

test("tsconfig is strict NodeNext ESM and builds only TypeScript source", () => {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(ROOT, "tsconfig.json"), "utf8"));
  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.equal(tsconfig.compilerOptions.module, "NodeNext");
  assert.equal(tsconfig.compilerOptions.moduleResolution, "NodeNext");
  assert.equal(tsconfig.compilerOptions.outDir, "dist");
  assert.deepEqual(tsconfig.include, ["src/**/*.ts"]);
});
```

- [ ] **Step 2: Verify current failure**

Run:

```powershell
node --test .\test\contracts\typescript-toolchain.test.mjs
npx tsc --noEmit
```

Expected:

- Contract test fails because scripts/devDependencies are missing.
- `npx tsc --noEmit` fails with the existing `tsc@2.0.4` warning unless TypeScript has already been installed.

- [ ] **Step 3: Add scripts and dependencies**

Modify `package.json`:

```json
{
  "name": "resume-job-board-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "doctor": "node tools/job_board_harness.mjs doctor",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "node --test tools/job_board_harness.test.mjs tools/github_edge_workflow.test.mjs test/unit/*.test.mjs test/contracts/*.test.mjs",
    "test:unit": "node --test test/unit/*.test.mjs",
    "test:contracts": "node --test test/contracts/*.test.mjs",
    "verify": "npm run typecheck && npm test"
  },
  "dependencies": {
    "commander": "^14.0.0",
    "yaml": "^2.8.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.9.0"
  }
}
```

Install using the workspace mirror:

```powershell
npm config set registry https://registry.npmmirror.com
npm install
```

- [ ] **Step 4: Run toolchain verification**

Run:

```powershell
npm run typecheck
npm test
```

Expected:

- `npm run typecheck` uses local `node_modules/.bin/tsc`, not `npx` network fallback.
- Existing 77 tests still pass.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json tsconfig.json test\contracts\typescript-toolchain.test.mjs
git commit -m "chore: add TypeScript build and verification gates"
```

## Task 2: Define CommandResult And Error Model

**Files:**

- Create: `src/cli/command-result.ts`
- Create: `src/cli/errors.ts`
- Create: `test/unit/command-result.test.mjs`
- Create: `test/contracts/exit-code-matrix.test.mjs`
- Modify: `docs/harness-contracts.md`

- [ ] **Step 1: Write failing tests**

Create `test/unit/command-result.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import {
  exitCodeForCategory,
  makeCommandResult,
} from "../../dist/cli/command-result.js";

test("command result maps stable categories to stable exit codes", () => {
  assert.equal(exitCodeForCategory("success"), 0);
  assert.equal(exitCodeForCategory("internal_error"), 1);
  assert.equal(exitCodeForCategory("config_error"), 2);
  assert.equal(exitCodeForCategory("data_error"), 2);
  assert.equal(exitCodeForCategory("auth_required"), 3);
  assert.equal(exitCodeForCategory("access_limited"), 3);
  assert.equal(exitCodeForCategory("browser_unavailable"), 4);
  assert.equal(exitCodeForCategory("external_action_blocked"), 5);
});

test("makeCommandResult creates deterministic JSON payloads", () => {
  const result = makeCommandResult({
    category: "auth_required",
    message: "BOSS login is required.",
    payload: { site: "boss" },
    artifacts: { auth: ".tmp/job_board_harness/auth_status.json" },
    nextAction: "Open login page and retry auth.",
  });
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 3);
  assert.equal(result.category, "auth_required");
  assert.deepEqual(Object.keys(result).sort(), [
    "artifacts",
    "category",
    "exitCode",
    "message",
    "nextAction",
    "ok",
    "payload",
  ]);
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

test("harness contract documents command exit categories", () => {
  const text = fs.readFileSync(path.join(ROOT, "docs", "harness-contracts.md"), "utf8");
  for (const term of [
    "success",
    "auth_required",
    "access_limited",
    "browser_unavailable",
    "config_error",
    "data_error",
    "external_action_blocked",
    "internal_error",
  ]) {
    assert.match(text, new RegExp(term));
  }
});
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npm run build
node --test .\test\unit\command-result.test.mjs .\test\contracts\exit-code-matrix.test.mjs
```

Expected:

- Build fails or tests fail because `dist/cli/command-result.js` does not exist.

- [ ] **Step 3: Implement command result types**

Create `src/cli/command-result.ts`:

```typescript
export type ExitCategory =
  | "success"
  | "auth_required"
  | "access_limited"
  | "browser_unavailable"
  | "config_error"
  | "data_error"
  | "external_action_blocked"
  | "internal_error";

export type ExitCode = 0 | 1 | 2 | 3 | 4 | 5;

export interface CommandResult<TPayload = unknown> {
  ok: boolean;
  exitCode: ExitCode;
  category: ExitCategory;
  message: string;
  payload: TPayload;
  artifacts?: Record<string, string>;
  nextAction?: string;
}

export function exitCodeForCategory(category: ExitCategory): ExitCode {
  switch (category) {
    case "success":
      return 0;
    case "internal_error":
      return 1;
    case "config_error":
    case "data_error":
      return 2;
    case "auth_required":
    case "access_limited":
      return 3;
    case "browser_unavailable":
      return 4;
    case "external_action_blocked":
      return 5;
  }
}

export function makeCommandResult<TPayload>(input: {
  category: ExitCategory;
  message: string;
  payload: TPayload;
  artifacts?: Record<string, string>;
  nextAction?: string;
}): CommandResult<TPayload> {
  const exitCode = exitCodeForCategory(input.category);
  return {
    ok: exitCode === 0,
    exitCode,
    category: input.category,
    message: input.message,
    payload: input.payload,
    ...(input.artifacts ? { artifacts: input.artifacts } : {}),
    ...(input.nextAction ? { nextAction: input.nextAction } : {}),
  };
}
```

Create `src/cli/errors.ts`:

```typescript
import type { ExitCategory } from "./command-result.js";

export class HarnessError extends Error {
  readonly category: ExitCategory;
  readonly payload: Record<string, unknown>;
  readonly nextAction?: string;

  constructor(input: {
    category: ExitCategory;
    message: string;
    payload?: Record<string, unknown>;
    nextAction?: string;
  }) {
    super(input.message);
    this.name = "HarnessError";
    this.category = input.category;
    this.payload = input.payload ?? {};
    this.nextAction = input.nextAction;
  }
}
```

- [ ] **Step 4: Update contract docs**

Modify `docs/harness-contracts.md` to include:

```markdown
## Exit Code Matrix

| Exit code | Category | Meaning |
| --- | --- | --- |
| 0 | `success` | Operation completed. |
| 1 | `internal_error` | Unexpected harness bug. |
| 2 | `config_error` / `data_error` | Invalid config, missing profile, invalid artifact, or schema mismatch. |
| 3 | `auth_required` / `access_limited` | Login, captcha, verification, throttling, or access-limit requires user action. |
| 4 | `browser_unavailable` | Edge Beta executable, profile, or CDP endpoint is unavailable. |
| 5 | `external_action_blocked` | A command attempted external action without explicit user permission or strict verification. |
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm run build
node --test .\test\unit\command-result.test.mjs .\test\contracts\exit-code-matrix.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src\cli\command-result.ts src\cli\errors.ts docs\harness-contracts.md test\unit\command-result.test.mjs test\contracts\exit-code-matrix.test.mjs
git commit -m "feat: add typed command result contract"
```

## Task 3: Add Artifact Schemas And Atomic Store

**Files:**

- Create: `src/artifacts/artifact-types.ts`
- Create: `src/artifacts/schemas.ts`
- Create: `src/artifacts/validate.ts`
- Create: `src/artifacts/read.ts`
- Create: `src/artifacts/write.ts`
- Create: `src/artifacts/paths.ts`
- Create: `src/artifacts/migrations.ts`
- Create: `test/contracts/artifact-schema.test.mjs`
- Create: `test/unit/artifact-store.test.mjs`

- [ ] **Step 1: Write failing artifact tests**

Create `test/contracts/artifact-schema.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import {
  validateArtifactBase,
  validateRunManifest,
} from "../../dist/artifacts/validate.js";

test("artifact base requires versioned local harness envelope", () => {
  const valid = validateArtifactBase({
    schema_version: "CandidateCollection.v1",
    artifact_type: "CandidateCollection",
    created_at: "2026-05-17T00:00:00.000Z",
    producer: "job-board-harness",
    input_artifacts: [],
    meta: {},
  });
  assert.equal(valid.ok, true);

  const invalid = validateArtifactBase({
    artifact_type: "CandidateCollection",
    producer: "job-board-harness",
    input_artifacts: [],
    meta: {},
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /schema_version/);
});

test("run manifest records stage auditability", () => {
  const result = validateRunManifest({
    schema_version: "RunManifest.v1",
    artifact_type: "RunManifest",
    created_at: "2026-05-17T00:00:00.000Z",
    producer: "job-board-harness",
    run_id: "run-test",
    input_artifacts: [],
    meta: {},
    stages: [{
      stage: "auth",
      status: "passed",
      exit_code: 0,
      started_at: "2026-05-17T00:00:00.000Z",
      finished_at: "2026-05-17T00:00:01.000Z",
      input_artifacts: [],
      output_artifacts: [],
      warnings: [],
      requires_user_action: false,
      recoverable: true,
      next_action: "",
    }],
  });
  assert.equal(result.ok, true);
});
```

Create `test/unit/artifact-store.test.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readArtifact } from "../../dist/artifacts/read.js";
import { writeArtifactAtomic } from "../../dist/artifacts/write.js";

test("artifact store writes JSON atomically and reads it back", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-artifacts-"));
  const file = path.join(dir, "manifest.json");
  const artifact = {
    schema_version: "RunManifest.v1",
    artifact_type: "RunManifest",
    created_at: "2026-05-17T00:00:00.000Z",
    producer: "job-board-harness",
    run_id: "run-test",
    input_artifacts: [],
    meta: {},
    stages: [],
  };
  writeArtifactAtomic(file, artifact);
  assert.deepEqual(readArtifact(file), artifact);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npm run build
node --test .\test\contracts\artifact-schema.test.mjs .\test\unit\artifact-store.test.mjs
```

Expected: FAIL because artifact modules do not exist.

- [ ] **Step 3: Implement artifact types**

Create `src/artifacts/artifact-types.ts`:

```typescript
export interface ArtifactBase {
  schema_version: string;
  artifact_type: string;
  created_at: string;
  producer: "job-board-harness";
  run_id?: string;
  input_artifacts: string[];
  meta: Record<string, unknown>;
}

export type StageStatus = "passed" | "failed" | "skipped" | "blocked";

export interface RunStageResult {
  stage: string;
  status: StageStatus;
  exit_code: 0 | 1 | 2 | 3 | 4 | 5;
  started_at: string;
  finished_at: string;
  input_artifacts: string[];
  output_artifacts: string[];
  warnings: string[];
  requires_user_action: boolean;
  recoverable: boolean;
  next_action: string;
}

export interface RunManifest extends ArtifactBase {
  schema_version: "RunManifest.v1";
  artifact_type: "RunManifest";
  run_id: string;
  stages: RunStageResult[];
}
```

Create `src/artifacts/schemas.ts`:

```typescript
import { z } from "zod";

export const artifactBaseSchema = z.object({
  schema_version: z.string().min(1),
  artifact_type: z.string().min(1),
  created_at: z.string().datetime(),
  producer: z.literal("job-board-harness"),
  run_id: z.string().optional(),
  input_artifacts: z.array(z.string()),
  meta: z.record(z.string(), z.unknown()),
});

export const runStageResultSchema = z.object({
  stage: z.string().min(1),
  status: z.enum(["passed", "failed", "skipped", "blocked"]),
  exit_code: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  started_at: z.string().datetime(),
  finished_at: z.string().datetime(),
  input_artifacts: z.array(z.string()),
  output_artifacts: z.array(z.string()),
  warnings: z.array(z.string()),
  requires_user_action: z.boolean(),
  recoverable: z.boolean(),
  next_action: z.string(),
});

export const runManifestSchema = artifactBaseSchema.extend({
  schema_version: z.literal("RunManifest.v1"),
  artifact_type: z.literal("RunManifest"),
  run_id: z.string().min(1),
  stages: z.array(runStageResultSchema),
});
```

Create `src/artifacts/validate.ts`:

```typescript
import { artifactBaseSchema, runManifestSchema } from "./schemas.js";

export type ValidationResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

function parse(schema: { safeParse: (input: unknown) => { success: boolean; data?: unknown; error?: { message: string } } }, input: unknown): ValidationResult {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error?.message ?? "Invalid artifact" };
}

export function validateArtifactBase(input: unknown): ValidationResult {
  return parse(artifactBaseSchema, input);
}

export function validateRunManifest(input: unknown): ValidationResult {
  return parse(runManifestSchema, input);
}
```

Create `src/artifacts/write.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";

export function writeArtifactAtomic(file: string, artifact: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}
```

Create `src/artifacts/read.ts`:

```typescript
import fs from "node:fs";

export function readArtifact(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
```

Create `src/artifacts/paths.ts`:

```typescript
import path from "node:path";

export function runArtifactPath(root: string, runId: string, fileName: string): string {
  return path.join(root, ".tmp", "job_board_harness", "runs", runId, fileName);
}
```

Create `src/artifacts/migrations.ts`:

```typescript
export function migrateArtifact(input: unknown): unknown {
  return input;
}
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm run build
node --test .\test\contracts\artifact-schema.test.mjs .\test\unit\artifact-store.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src\artifacts test\contracts\artifact-schema.test.mjs test\unit\artifact-store.test.mjs
git commit -m "feat: add versioned artifact schemas"
```

## Task 4: Productize Browser Policy And CDP Port

**Files:**

- Create: `src/browser/browser-port.ts`
- Create: `src/browser/browser-policy.ts`
- Create: `src/browser/cdp-session.ts`
- Create: `src/browser/edge-beta-cdp-browser.ts`
- Modify: `src/config/browser-config.mjs`
- Modify: `src/cli/runtime.mjs`
- Modify: `test/contracts/browser-policy.test.mjs`
- Modify: `test/contracts/no-mcp-fallback.test.mjs`

- [ ] **Step 1: Extend browser policy tests**

Add to `test/contracts/browser-policy.test.mjs`:

```javascript
test("typed browser policy exposes Edge Beta CDP as the only live adapter", async () => {
  const { createStrictBrowserPolicy } = await import("../../dist/browser/browser-policy.js");
  const policy = createStrictBrowserPolicy();
  assert.equal(policy.requiredFamily, "edge-beta");
  assert.equal(policy.allowFallbackFamily, false);
  assert.equal(policy.requiredControlPlane, "cdp");
  assert.equal(policy.allowManagedBrowser, false);
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm run build
node --test .\test\contracts\browser-policy.test.mjs .\test\contracts\no-mcp-fallback.test.mjs
```

Expected: FAIL because typed browser modules do not exist.

- [ ] **Step 3: Implement typed browser port**

Create `src/browser/browser-port.ts`:

```typescript
export type SiteId = "boss" | "liepin" | "51job";

export interface CdpEndpoint {
  port: number;
  browser: string;
  webSocketDebuggerUrl?: string;
}

export interface PageTarget {
  id: string;
  url: string;
  title: string;
  type: string;
}

export interface BrowserDoctorResult {
  available: boolean;
  endpoint?: CdpEndpoint;
  problem?: string;
}

export interface OpenRecord {
  id?: string;
  site?: SiteId;
  title?: string;
  company?: string;
  location?: string;
  url: string;
}

export interface OpenOptions {
  maxPerBatch: number;
  delayMs: number;
  triggerContact: boolean;
}

export interface OpenResult {
  opened: OpenRecord[];
  skipped: OpenRecord[];
  accessLimited: boolean;
}

export interface CloseResult {
  closed: string[];
  failed: string[];
}

export interface BrowserSession {
  readonly kind: "edge-beta-cdp";
  doctor(): Promise<BrowserDoctorResult>;
  ensureAvailable(options: { port?: number; start?: boolean }): Promise<CdpEndpoint>;
  listJobBoardTargets(site: SiteId | "both"): Promise<PageTarget[]>;
  openBackgroundTabs(records: OpenRecord[], options: OpenOptions): Promise<OpenResult>;
  evaluateTarget<T>(target: PageTarget, expression: string): Promise<T>;
  closeTargets(targetIds: string[]): Promise<CloseResult>;
}
```

Create `src/browser/browser-policy.ts`:

```typescript
export interface BrowserPolicy {
  requiredFamily: "edge-beta";
  allowFallbackFamily: boolean;
  requiredControlPlane: "cdp";
  allowManagedBrowser: boolean;
}

export function createStrictBrowserPolicy(): BrowserPolicy {
  return {
    requiredFamily: "edge-beta",
    allowFallbackFamily: false,
    requiredControlPlane: "cdp",
    allowManagedBrowser: false,
  };
}
```

Create `src/browser/cdp-session.ts`:

```typescript
export async function fetchCdpJson<T>(url: string, timeoutMs = 1500): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`CDP HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}
```

Create `src/browser/edge-beta-cdp-browser.ts` with a thin adapter first:

```typescript
import type {
  BrowserDoctorResult,
  BrowserSession,
  CdpEndpoint,
  CloseResult,
  OpenOptions,
  OpenRecord,
  OpenResult,
  PageTarget,
  SiteId,
} from "./browser-port.js";
import { fetchCdpJson } from "./cdp-session.js";

export class EdgeBetaCdpBrowser implements BrowserSession {
  readonly kind = "edge-beta-cdp" as const;

  constructor(private readonly defaultPort = 9222) {}

  async doctor(): Promise<BrowserDoctorResult> {
    try {
      const endpoint = await this.ensureAvailable({ port: this.defaultPort, start: false });
      return { available: true, endpoint };
    } catch (error) {
      return { available: false, problem: error instanceof Error ? error.message : String(error) };
    }
  }

  async ensureAvailable(options: { port?: number; start?: boolean }): Promise<CdpEndpoint> {
    const port = options.port ?? this.defaultPort;
    const version = await fetchCdpJson<{ Browser: string; webSocketDebuggerUrl?: string }>(`http://127.0.0.1:${port}/json/version`);
    return { port, browser: version.Browser, webSocketDebuggerUrl: version.webSocketDebuggerUrl };
  }

  async listJobBoardTargets(site: SiteId | "both"): Promise<PageTarget[]> {
    const targets = await fetchCdpJson<PageTarget[]>(`http://127.0.0.1:${this.defaultPort}/json/list`);
    return targets.filter((target) => {
      if (site === "both") return /zhipin\.com|liepin\.com|51job\.com/i.test(target.url);
      if (site === "boss") return /zhipin\.com/i.test(target.url);
      if (site === "liepin") return /liepin\.com/i.test(target.url);
      return /51job\.com/i.test(target.url);
    });
  }

  async openBackgroundTabs(_records: OpenRecord[], _options: OpenOptions): Promise<OpenResult> {
    throw new Error("openBackgroundTabs is migrated in Task 10");
  }

  async evaluateTarget<T>(_target: PageTarget, _expression: string): Promise<T> {
    throw new Error("evaluateTarget is migrated in Task 7");
  }

  async closeTargets(_targetIds: string[]): Promise<CloseResult> {
    throw new Error("closeTargets is migrated in Task 10");
  }
}
```

- [ ] **Step 4: Bridge runtime to typed policy without changing behavior**

Modify `src/cli/runtime.mjs` only at the policy-reporting boundary:

- Keep existing `resolveBrowserConfig()` behavior.
- Include `family`, `policy`, and `problem` in `doctor`.
- Do not import TypeScript dist from `runtime.mjs` yet.

- [ ] **Step 5: Live-safe verification**

Run:

```powershell
npm run build
node --test .\test\contracts\browser-policy.test.mjs .\test\contracts\no-mcp-fallback.test.mjs
node .\tools\job_board_harness.mjs doctor
node .\tools\job_board_harness.mjs auth --site both --reuse-page --no-open-login
```

Expected:

- Tests PASS.
- `doctor` reports `family: "edge-beta"` and `problem: null` on this machine.
- `auth` remains read-only and returns both sites logged in or clear user-action status.

- [ ] **Step 6: Commit**

```powershell
git add src\browser src\config\browser-config.mjs src\cli\runtime.mjs test\contracts\browser-policy.test.mjs test\contracts\no-mcp-fallback.test.mjs
git commit -m "feat: define Edge Beta CDP browser port"
```

## Task 5: Replace YAML Parser With Schema-Validated Config Loading

**Files:**

- Create: `src/config/profile-schema.ts`
- Create: `src/config/browser-schema.ts`
- Create: `src/config/batch-schema.ts`
- Create: `src/config/load-config.ts`
- Modify: `src/config/load-config.mjs`
- Modify: `src/config/simple-yaml.mjs`
- Modify: `test/unit/config-validation.test.mjs`
- Modify: `test/unit/browser-config.test.mjs`

- [ ] **Step 1: Add failing config schema tests**

Add to `test/unit/config-validation.test.mjs`:

```javascript
test("typed role profile schema validates current durable profiles", async () => {
  const { validateRoleProfileConfig } = await import("../../dist/config/profile-schema.js");
  const profile = {
    id: "ai-agent-dev",
    label: "AI Agent 工程化",
    version: 1,
    include: ["AI Agent", "LLM"],
    exclude: ["销售"],
    hard_filters: { min_salary_k: 15, max_experience_years: 8 },
    batch: { max_per_batch: 15, cooldown_ms: 45000, jitter_ms: 10000 },
    review_policy: { codex_review_top_n: 8, codex_review_borderline_n: 5 },
  };
  const result = validateRoleProfileConfig(profile);
  assert.equal(result.ok, true);
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm run build
node --test .\test\unit\config-validation.test.mjs .\test\unit\browser-config.test.mjs
```

Expected: FAIL because typed config schema modules do not exist.

- [ ] **Step 3: Implement schemas**

Create `src/config/profile-schema.ts`:

```typescript
import { z } from "zod";

const termArray = z.array(z.string().min(1)).default([]);

export const roleProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  version: z.number().int().positive().default(1),
  include: termArray,
  exclude: termArray,
  hard_filters: z.record(z.string(), z.unknown()).default({}),
  batch: z.record(z.string(), z.unknown()).default({}),
  review_policy: z.record(z.string(), z.unknown()).default({}),
}).passthrough();

export function validateRoleProfileConfig(input: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const parsed = roleProfileSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: parsed.error.message };
}
```

Create `src/config/browser-schema.ts`:

```typescript
import { z } from "zod";

export const browserPolicySchema = z.object({
  required_family: z.literal("edge-beta").default("edge-beta"),
  allow_fallback_family: z.boolean().default(false),
  require_cdp: z.boolean().default(true),
  require_dedicated_profile: z.boolean().default(true),
});

export const browserConfigSchema = z.object({
  browser_exe: z.string().nullable().optional(),
  browser_profile: z.string().nullable().optional(),
  browser_policy: browserPolicySchema.default({}),
}).passthrough();
```

Create `src/config/batch-schema.ts`:

```typescript
import { z } from "zod";

export const batchPolicySchema = z.object({
  max_per_batch: z.number().int().positive().max(50).default(15),
  batch_cooldown_ms: z.number().int().nonnegative().default(45000),
  jitter_ms: z.number().int().nonnegative().default(10000),
  stop_on_access_limited: z.boolean().default(true),
});
```

Create `src/config/load-config.ts`:

```typescript
import fs from "node:fs";
import YAML from "yaml";

export function loadYamlFile(file: string): unknown {
  const text = fs.readFileSync(file, "utf8");
  return YAML.parse(text);
}
```

- [ ] **Step 4: Bridge existing `.mjs` config loader**

Modify `src/config/load-config.mjs`:

- Keep exported function names stable.
- Internally replace direct `simple-yaml.mjs` parser calls with `yaml` package parsing.
- Preserve current profile shape so existing tests still pass.
- Return `config_error` through command result only after Task 6 command result integration.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run build
node --test .\test\unit\config-validation.test.mjs .\test\unit\browser-config.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src\config package.json package-lock.json test\unit\config-validation.test.mjs test\unit\browser-config.test.mjs
git commit -m "feat: validate harness configuration schemas"
```

## Task 6: Introduce Typed CLI Main Without Switching The Wrapper

**Files:**

- Create: `src/cli/main.ts`
- Create: `src/cli/parser.ts`
- Modify: `src/cli/index.ts`
- Modify: `src/cli/commands/doctor.ts`
- Create: `test/unit/typed-cli-main.test.mjs`
- Modify: `test/unit/job-board-architecture-cli.test.mjs`

- [ ] **Step 1: Write failing typed CLI tests**

Create `test/unit/typed-cli-main.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { main } from "../../dist/cli/main.js";

test("typed CLI returns unknown command as data_error without spawning legacy harness", async () => {
  const writes = [];
  const exitCode = await main(["unknown-command"], {
    stdout: (line) => writes.push(line),
    stderr: (line) => writes.push(line),
  });
  assert.equal(exitCode, 2);
  assert.match(writes.join("\n"), /Unknown command/);
});

test("typed CLI can route doctor through typed command registry", async () => {
  const writes = [];
  const exitCode = await main(["doctor", "--dry-run"], {
    stdout: (line) => writes.push(line),
    stderr: (line) => writes.push(line),
  });
  assert.equal(exitCode, 0);
  assert.match(writes.join("\n"), /doctor/);
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm run build
node --test .\test\unit\typed-cli-main.test.mjs
```

Expected: FAIL because typed CLI main does not exist.

- [ ] **Step 3: Implement parser and main**

Create `src/cli/parser.ts`:

```typescript
export interface ParsedArgs {
  command: string;
  args: string[];
}

export function parseCliArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...args] = argv;
  return { command, args };
}
```

Create `src/cli/main.ts`:

```typescript
import { makeCommandResult, type CommandResult } from "./command-result.js";
import { parseCliArgs } from "./parser.js";
import { run as runDoctor } from "./commands/doctor.js";

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}

type CommandHandler = (args: string[]) => Promise<CommandResult> | CommandResult;

const commands: Record<string, CommandHandler> = {
  doctor: runDoctor,
};

export async function main(argv = process.argv.slice(2), io: CliIo = console): Promise<number> {
  const parsed = parseCliArgs(argv);
  const handler = commands[parsed.command];
  if (!handler) {
    const result = makeCommandResult({
      category: "data_error",
      message: `Unknown command: ${parsed.command}`,
      payload: { command: parsed.command },
      nextAction: "Run help.",
    });
    io.stderr(JSON.stringify(result, null, 2));
    return result.exitCode;
  }
  const result = await handler(parsed.args);
  io.stdout(JSON.stringify(result, null, 2));
  return result.exitCode;
}
```

Modify `src/cli/commands/doctor.ts` temporarily:

```typescript
import { makeCommandResult, type CommandResult } from "../command-result.js";

export const commandName = "doctor";

export function run(args: string[] = []): CommandResult {
  if (args.includes("--dry-run")) {
    return makeCommandResult({
      category: "success",
      message: "doctor dry-run",
      payload: { command: commandName, dryRun: true },
    });
  }
  return makeCommandResult({
    category: "success",
    message: "doctor remains served by legacy runtime until Task 8",
    payload: { command: commandName, legacy: true },
  });
}
```

Modify `src/cli/index.ts`:

```typescript
export { main } from "./main.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
```

- [ ] **Step 4: Verify without switching `tools/job_board_harness.mjs`**

Run:

```powershell
npm run build
node --test .\test\unit\typed-cli-main.test.mjs .\test\unit\job-board-architecture-cli.test.mjs
node .\tools\job_board_harness.mjs doctor
```

Expected:

- Typed CLI tests PASS.
- Existing harness still uses `src/cli/runtime.mjs` and live `doctor` remains unchanged.

- [ ] **Step 5: Commit**

```powershell
git add src\cli\main.ts src\cli\parser.ts src\cli\index.ts src\cli\commands\doctor.ts test\unit\typed-cli-main.test.mjs test\unit\job-board-architecture-cli.test.mjs
git commit -m "feat: introduce typed CLI command registry"
```

## Task 7: Migrate Pure Use Cases

**Files:**

- Create: `src/core/use-cases/rank-candidates.ts`
- Create: `src/core/use-cases/build-agent-review.ts`
- Create: `src/core/use-cases/select-candidates.ts`
- Create: `src/core/use-cases/record-feedback.ts`
- Modify: `src/cli/commands/rank.ts`
- Modify: `src/cli/commands/agent-review.ts`
- Modify: `src/cli/commands/select.ts`
- Modify: `src/cli/commands/feedback.ts`
- Modify: `src/rank/keyword-ranker.mjs`
- Modify: `src/agent/prompt-contracts.mjs`
- Modify: `src/agent/review-runner.mjs`
- Create: `test/unit/use-case-rank.test.mjs`
- Create: `test/unit/use-case-agent-review.test.mjs`
- Create: `test/unit/use-case-select.test.mjs`

- [ ] **Step 1: Write failing rank use case test**

Create `test/unit/use-case-rank.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { rankCandidates } from "../../dist/core/use-cases/rank-candidates.js";

test("rankCandidates scores fixture-like records without browser access", () => {
  const result = rankCandidates({
    records: [{
      site: "boss",
      id: "boss_ai_agent",
      titleText: "AI Agent 工程师",
      cardText: "负责 LLM、RAG、浏览器自动化。",
      url: "https://www.zhipin.com/job_detail/boss_ai_agent.html",
    }],
    profile: {
      include: ["AI Agent", "LLM", "RAG"],
      exclude: ["销售"],
      hard_filters: {},
    },
    options: { max: 15, minScore: 8 },
  });
  assert.equal(result.selected.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.selected[0].canonical_key, "boss:boss_ai_agent");
});
```

- [ ] **Step 2: Run failing pure use case tests**

Run:

```powershell
npm run build
node --test .\test\unit\use-case-rank.test.mjs
```

Expected: FAIL because use case does not exist.

- [ ] **Step 3: Extract pure rank logic**

Create `src/core/use-cases/rank-candidates.ts`:

```typescript
export interface RankRecord {
  site?: string;
  id?: string;
  url: string;
  titleText?: string;
  cardText?: string;
}

export interface RankProfile {
  include?: string[];
  exclude?: string[];
  hard_filters?: Record<string, unknown>;
}

export interface RankOptions {
  max: number;
  minScore: number;
}

export interface RankedRecord extends RankRecord {
  score: number;
  canonical_key: string;
  reasons: string[];
  penalties: string[];
}

function canonicalKey(record: RankRecord): string {
  const site = record.site ?? "unknown";
  const id = record.id ?? record.url;
  return `${site}:${id}`;
}

function hit(text: string, term: string): boolean {
  return text.toLowerCase().includes(term.toLowerCase());
}

export function rankCandidates(input: {
  records: RankRecord[];
  profile: RankProfile;
  options: RankOptions;
}): { selected: RankedRecord[]; ranked: RankedRecord[]; rejected: RankedRecord[] } {
  const include = input.profile.include ?? [];
  const exclude = input.profile.exclude ?? [];
  const ranked = input.records.map((record) => {
    const text = `${record.titleText ?? ""}\n${record.cardText ?? ""}`;
    const reasons = include.filter((term) => hit(text, term));
    const penalties = exclude.filter((term) => hit(text, term));
    const score = reasons.length * 20 - penalties.length * 40;
    return { ...record, score, canonical_key: canonicalKey(record), reasons, penalties };
  }).sort((a, b) => b.score - a.score);
  const selected = ranked.filter((record) => record.score >= input.options.minScore).slice(0, input.options.max);
  const selectedKeys = new Set(selected.map((record) => record.canonical_key));
  const rejected = ranked.filter((record) => !selectedKeys.has(record.canonical_key));
  return { selected, ranked, rejected };
}
```

Use this pure implementation as a temporary typed seam. In the same task, reconcile it with `src/rank/keyword-ranker.mjs` by moving exact scoring rules into a shared module or by wrapping current `.mjs` implementation behind a typed adapter. The temporary scoring above must not remain if it changes existing golden ranking behavior.

- [ ] **Step 4: Add pure use case wrappers for agent review and select**

Create `src/core/use-cases/build-agent-review.ts`:

```typescript
export function buildAgentReviewInput(input: {
  candidates: unknown[];
  profileId: string;
  topN: number;
}): { profile_id: string; candidates: unknown[]; guardrails: { no_external_actions: true } } {
  return {
    profile_id: input.profileId,
    candidates: input.candidates.slice(0, input.topN),
    guardrails: { no_external_actions: true },
  };
}
```

Create `src/core/use-cases/select-candidates.ts`:

```typescript
export function selectReviewedCandidates(input: {
  ranked: Array<{ id?: string; canonical_key?: string }>;
  review: { selection?: Array<{ id: string; decision: string }> };
}): { selectedIds: string[]; rejectedIds: string[] } {
  const allowed = new Set(input.ranked.map((record) => record.id ?? record.canonical_key).filter(Boolean));
  const selectedIds = [];
  for (const item of input.review.selection ?? []) {
    if (allowed.has(item.id) && item.decision === "select") selectedIds.push(item.id);
  }
  return {
    selectedIds,
    rejectedIds: [...allowed].filter((id) => !selectedIds.includes(id)),
  };
}
```

Create `src/core/use-cases/record-feedback.ts`:

```typescript
export function summarizeFeedback(input: { opened: number; duplicate: number; accessLimited: number }): {
  precision_denominator: number;
  duplicate_count: number;
  access_limited_count: number;
} {
  return {
    precision_denominator: input.opened,
    duplicate_count: input.duplicate,
    access_limited_count: input.accessLimited,
  };
}
```

- [ ] **Step 5: Switch typed command handlers one at a time**

For each command file, remove `runLegacyHarness` only after its targeted test passes:

```text
src/cli/commands/rank.ts
src/cli/commands/agent-review.ts
src/cli/commands/select.ts
src/cli/commands/feedback.ts
```

Each typed command must:

- parse only its own arguments;
- return `CommandResult`;
- read/write artifacts through `src/artifacts`;
- preserve existing CLI output shape until docs say otherwise.

- [ ] **Step 6: Verify pure migration**

Run:

```powershell
npm run build
node --test .\test\unit\use-case-rank.test.mjs .\test\unit\ranking-golden.test.mjs .\test\unit\agent-contracts.test.mjs .\test\unit\profile-feedback.test.mjs
npm test
```

Expected:

- Golden ranking remains unchanged.
- Agent contract still rejects invented ids and action directives.
- No live browser needed.

- [ ] **Step 7: Commit**

```powershell
git add src\core\use-cases src\cli\commands src\rank src\agent test\unit\use-case-rank.test.mjs test\unit\use-case-agent-review.test.mjs test\unit\use-case-select.test.mjs
git commit -m "refactor: migrate pure harness use cases to TypeScript"
```

## Task 8: Migrate Doctor And Auth To Typed Use Cases

**Files:**

- Create: `src/core/use-cases/doctor.ts`
- Create: `src/core/use-cases/auth-check.ts`
- Modify: `src/cli/commands/doctor.ts`
- Modify: `src/cli/commands/auth.ts`
- Modify: `src/browser/edge-beta-cdp-browser.ts`
- Create: `test/unit/use-case-doctor.test.mjs`
- Create: `test/unit/use-case-auth.test.mjs`

- [ ] **Step 1: Write failing doctor/auth use case tests**

Create `test/unit/use-case-doctor.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { runDoctor } from "../../dist/core/use-cases/doctor.js";

test("doctor reports browser unavailable with stable category", async () => {
  const result = await runDoctor({
    browser: { doctor: async () => ({ available: false, problem: "CDP unavailable" }) },
    now: () => "2026-05-17T00:00:00.000Z",
  });
  assert.equal(result.category, "browser_unavailable");
  assert.equal(result.exitCode, 4);
  assert.match(result.message, /CDP unavailable/);
});
```

Create `test/unit/use-case-auth.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { summarizeAuthResults } from "../../dist/core/use-cases/auth-check.js";

test("auth summary blocks on any access-limited site", () => {
  const result = summarizeAuthResults([
    { site: "boss", status: "logged-in", accessLimited: false },
    { site: "liepin", status: "access-limited", accessLimited: true },
  ]);
  assert.equal(result.category, "access_limited");
  assert.equal(result.exitCode, 3);
});
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npm run build
node --test .\test\unit\use-case-doctor.test.mjs .\test\unit\use-case-auth.test.mjs
```

Expected: FAIL because use cases do not exist.

- [ ] **Step 3: Implement typed doctor/auth core**

Create `src/core/use-cases/doctor.ts`:

```typescript
import { makeCommandResult, type CommandResult } from "../../cli/command-result.js";

export async function runDoctor(input: {
  browser: { doctor(): Promise<{ available: boolean; problem?: string; endpoint?: unknown }> };
  now(): string;
}): Promise<CommandResult> {
  const browser = await input.browser.doctor();
  if (!browser.available) {
    return makeCommandResult({
      category: "browser_unavailable",
      message: browser.problem ?? "Edge Beta CDP is unavailable.",
      payload: { checked_at: input.now(), browser },
      nextAction: "Run job-board start-browser, then retry doctor.",
    });
  }
  return makeCommandResult({
    category: "success",
    message: "Doctor checks passed.",
    payload: { checked_at: input.now(), browser },
  });
}
```

Create `src/core/use-cases/auth-check.ts`:

```typescript
import { makeCommandResult, type CommandResult } from "../../cli/command-result.js";

export interface AuthSiteResult {
  site: string;
  status: string;
  accessLimited: boolean;
}

export function summarizeAuthResults(results: AuthSiteResult[]): CommandResult {
  const limited = results.filter((result) => result.accessLimited || result.status === "access-limited");
  if (limited.length) {
    return makeCommandResult({
      category: "access_limited",
      message: "One or more sites require user action.",
      payload: { results },
      nextAction: "Resolve captcha or verification in Edge Beta, then retry auth.",
    });
  }
  const missing = results.filter((result) => result.status !== "logged-in" && result.status !== "probably-logged-in");
  if (missing.length) {
    return makeCommandResult({
      category: "auth_required",
      message: "One or more sites require login.",
      payload: { results },
      nextAction: "Open login page in Edge Beta, then retry auth.",
    });
  }
  return makeCommandResult({
    category: "success",
    message: "All requested sites are authenticated.",
    payload: { results },
  });
}
```

- [ ] **Step 4: Switch typed command handlers**

Modify `src/cli/commands/doctor.ts` to instantiate `EdgeBetaCdpBrowser` and call `runDoctor()`.

Modify `src/cli/commands/auth.ts` in two stages:

1. First, keep legacy runtime for live page evaluation but map its JSON result through `summarizeAuthResults()`.
2. After `page-evaluator.ts` is migrated, remove legacy auth call entirely.

- [ ] **Step 5: Live-safe verification**

Run:

```powershell
npm run build
node --test .\test\unit\use-case-doctor.test.mjs .\test\unit\use-case-auth.test.mjs .\test\unit\mock-cdp.test.mjs
node .\tools\job_board_harness.mjs doctor
node .\tools\job_board_harness.mjs auth --site both --reuse-page --no-open-login
```

Expected:

- Automated tests PASS.
- Live `doctor` and read-only `auth` still pass on the logged Edge Beta profile or return stable typed category.

- [ ] **Step 6: Commit**

```powershell
git add src\core\use-cases\doctor.ts src\core\use-cases\auth-check.ts src\cli\commands\doctor.ts src\cli\commands\auth.ts src\browser test\unit\use-case-doctor.test.mjs test\unit\use-case-auth.test.mjs
git commit -m "refactor: migrate doctor and auth use cases"
```

## Task 9: Complete Site Adapter Contract

**Files:**

- Create: `src/sites/adapter-contract.ts`
- Modify: `src/sites/boss.mjs`
- Modify: `src/sites/liepin.mjs`
- Modify: `src/sites/job51.mjs`
- Modify: `src/sites/registry.mjs`
- Modify: `src/cli/runtime.mjs`
- Create: `test/unit/site-adapter-contract.test.mjs`
- Modify: `test/unit/site-adapters.test.mjs`

- [ ] **Step 1: Write failing adapter contract tests**

Create `test/unit/site-adapter-contract.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { listSiteAdapters } from "../../src/sites/registry.mjs";

test("each site adapter owns URL, auth, collection, detail, access-limit, and contact contracts", () => {
  for (const adapter of listSiteAdapters()) {
    assert.equal(typeof adapter.id, "string", `${adapter.id}.id`);
    assert.equal(typeof adapter.canonicalize, "function", `${adapter.id}.canonicalize`);
    assert.equal(typeof adapter.searchUrl, "function", `${adapter.id}.searchUrl`);
    assert.equal(typeof adapter.authProbe, "function", `${adapter.id}.authProbe`);
    assert.equal(typeof adapter.collectExpression, "function", `${adapter.id}.collectExpression`);
    assert.equal(typeof adapter.detailExpression, "function", `${adapter.id}.detailExpression`);
    assert.equal(typeof adapter.accessLimitExpression, "function", `${adapter.id}.accessLimitExpression`);
    assert.equal(typeof adapter.contactActionSpec, "function", `${adapter.id}.contactActionSpec`);
  }
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
node --test .\test\unit\site-adapter-contract.test.mjs
```

Expected: FAIL until adapters expose the full contract.

- [ ] **Step 3: Add TypeScript adapter contract**

Create `src/sites/adapter-contract.ts`:

```typescript
export type SiteId = "boss" | "liepin" | "51job";

export interface CanonicalJobUrl {
  site: SiteId;
  id: string;
  url: string;
  semanticKey: string;
}

export interface SearchInput {
  query: string;
  city?: string;
}

export interface AuthProbeSpec {
  url: string;
  expression: string;
}

export interface ContactActionSpec {
  triggerExpression: string;
  verificationExpression: string;
  labels: string[];
}

export interface SiteAdapter {
  id: SiteId;
  hosts: RegExp[];
  canonicalize(url: string): CanonicalJobUrl | null;
  searchUrl(input: SearchInput): string;
  authProbe(): AuthProbeSpec;
  collectExpression(): string;
  detailExpression(): string;
  accessLimitExpression(): string;
  contactActionSpec(): ContactActionSpec | null;
}
```

- [ ] **Step 4: Move runtime expressions into adapters**

Move these `src/cli/runtime.mjs` responsibilities into site adapters:

```text
extractionExpression(site)
detailPageExpression()
authExpression()
accessLimitExpression()
siteMatches(url, site)
siteFromUrl(url)
contactExtractionExpression(site)
```

Keep temporary forwarders in `runtime.mjs`:

```javascript
function extractionExpression(site) {
  const adapter = getSiteAdapter(site);
  return adapter.collectExpression();
}
```

Do not delete fallback expressions until fixture extraction and live collect smoke both pass.

- [ ] **Step 5: Verify fixture and live-safe collection**

Run:

```powershell
node --test .\test\unit\site-adapter-contract.test.mjs .\test\unit\site-adapters.test.mjs .\test\unit\fixture-workflow.test.mjs .\test\unit\detail-phase.test.mjs
node .\tools\job_board_harness.mjs collect --site both --reuse-auth-page --no-open-login --out .tmp\job_board_harness\adapter_live_collect_smoke.json
```

Expected:

- Fixture tests PASS.
- Live collect writes JSON with `meta` and `items`, has `access_limited: false` or a stable user-action result.

- [ ] **Step 6: Commit**

```powershell
git add src\sites src\cli\runtime.mjs test\unit\site-adapter-contract.test.mjs test\unit\site-adapters.test.mjs
git commit -m "refactor: move site contracts into adapters"
```

## Task 10: Migrate Collect And Detail Extraction

**Files:**

- Create: `src/browser/page-evaluator.ts`
- Create: `src/browser/target-repository.ts`
- Create: `src/browser/access-limit-inspector.ts`
- Create: `src/core/use-cases/collect-candidates.ts`
- Create: `src/core/use-cases/extract-details.ts`
- Modify: `src/cli/commands/collect.ts`
- Modify: `src/cli/commands/extract-details.ts`
- Modify: `src/extract/collect-links.mjs`
- Modify: `src/extract/extract-detail.mjs`
- Create: `test/unit/use-case-collect.test.mjs`
- Create: `test/unit/use-case-extract-details.test.mjs`

- [ ] **Step 1: Write failing collection/detail use case tests**

Create `test/unit/use-case-collect.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { collectCandidatesFromTargets } from "../../dist/core/use-cases/collect-candidates.js";

test("collectCandidatesFromTargets merges page records and access-limit state", async () => {
  const result = await collectCandidatesFromTargets({
    targets: [{ id: "1", url: "https://www.zhipin.com/web/geek/jobs", title: "BOSS", type: "page" }],
    evaluate: async () => ({
      accessLimited: false,
      items: [{ site: "boss", id: "job-1", url: "https://www.zhipin.com/job_detail/job-1.html", titleText: "AI Agent" }],
    }),
  });
  assert.equal(result.category, "success");
  assert.equal(result.payload.items.length, 1);
});
```

Create `test/unit/use-case-extract-details.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { mergeDetailRecords } from "../../dist/core/use-cases/extract-details.js";

test("mergeDetailRecords preserves ranking evidence and adds detail evidence", () => {
  const merged = mergeDetailRecords({
    selected: [{ id: "job-1", title: "AI Agent", score: 80 }],
    details: [{ id: "job-1", requirements: ["LLM", "RAG"], salary: "25-45K" }],
  });
  assert.equal(merged[0].salary, "25-45K");
  assert.deepEqual(merged[0].requirements, ["LLM", "RAG"]);
});
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npm run build
node --test .\test\unit\use-case-collect.test.mjs .\test\unit\use-case-extract-details.test.mjs
```

Expected: FAIL until modules exist.

- [ ] **Step 3: Implement use case seams**

Create `src/core/use-cases/collect-candidates.ts`:

```typescript
import { makeCommandResult } from "../../cli/command-result.js";
import type { PageTarget } from "../../browser/browser-port.js";

export async function collectCandidatesFromTargets(input: {
  targets: PageTarget[];
  evaluate(target: PageTarget): Promise<{ accessLimited: boolean; items: unknown[] }>;
}) {
  const items = [];
  const limitedPages = [];
  for (const target of input.targets) {
    const result = await input.evaluate(target);
    if (result.accessLimited) limitedPages.push(target.url);
    items.push(...result.items);
  }
  if (limitedPages.length) {
    return makeCommandResult({
      category: "access_limited",
      message: "One or more collection pages are access limited.",
      payload: { items, limited_pages: limitedPages },
      nextAction: "Resolve verification in Edge Beta and retry collect.",
    });
  }
  return makeCommandResult({
    category: "success",
    message: "Candidate collection completed.",
    payload: { items, limited_pages: [] },
  });
}
```

Create `src/core/use-cases/extract-details.ts`:

```typescript
export function mergeDetailRecords(input: {
  selected: Array<Record<string, unknown>>;
  details: Array<Record<string, unknown>>;
}): Array<Record<string, unknown>> {
  const detailsById = new Map(input.details.map((record) => [String(record.id), record]));
  return input.selected.map((record) => {
    const detail = detailsById.get(String(record.id)) ?? {};
    return { ...record, ...detail };
  });
}
```

Implement `src/browser/page-evaluator.ts`, `target-repository.ts`, and `access-limit-inspector.ts` by moving CDP target listing/evaluation code out of `runtime.mjs` without changing expressions.

- [ ] **Step 4: Verify fixture and live read-only flows**

Run:

```powershell
npm run build
node --test .\test\unit\use-case-collect.test.mjs .\test\unit\use-case-extract-details.test.mjs .\test\unit\fixture-workflow.test.mjs .\test\unit\detail-phase.test.mjs
node .\tools\job_board_harness.mjs collect --site both --reuse-auth-page --no-open-login --out .tmp\job_board_harness\collect_typed_smoke.json
node .\tools\job_board_harness.mjs rank --input .tmp\job_board_harness\collect_typed_smoke.json --profile ai-agent-dev --out .tmp\job_board_harness\rank_typed_smoke.json
```

Expected:

- Tests PASS.
- Live collect is allowed to return zero selected after rank; that is a profile-fit result, not a collection failure.

- [ ] **Step 5: Commit**

```powershell
git add src\browser src\core\use-cases\collect-candidates.ts src\core\use-cases\extract-details.ts src\cli\commands\collect.ts src\cli\commands\extract-details.ts src\extract test\unit\use-case-collect.test.mjs test\unit\use-case-extract-details.test.mjs
git commit -m "refactor: migrate collect and detail extraction"
```

## Task 11: Add Open Ledger And Queue Store

**Files:**

- Create: `src/state/state-types.ts`
- Create: `src/state/open-ledger.ts`
- Create: `src/state/queue-store.ts`
- Create: `src/state/run-store.ts`
- Modify: `src/state/opened-state.mjs`
- Modify: `src/batch/queue.mjs`
- Create: `test/unit/open-ledger.test.mjs`
- Create: `test/integration/state-recovery.test.mjs`

- [ ] **Step 1: Write failing ledger tests**

Create `test/unit/open-ledger.test.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { appendOpenLedgerEvent, loadOpenLedger } from "../../dist/state/open-ledger.js";

test("open ledger records and loads semantic identity keys", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "open-ledger-"));
  const file = path.join(dir, "open_ledger.jsonl");
  appendOpenLedgerEvent(file, {
    schema_version: "OpenLedgerEvent.v1",
    created_at: "2026-05-17T00:00:00.000Z",
    action: "opened",
    identity_keys: ["boss:job-1", "semantic:ai-agent:future-ai:shenzhen"],
    record: { id: "job-1" },
    source_artifact: "open_queue.json",
  });
  const loaded = loadOpenLedger(file);
  assert.equal(loaded.events.length, 1);
  assert.equal(loaded.keys.has("boss:job-1"), true);
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
    for (const key of event.identity_keys) keys.add(key);
  }
  return { events, keys };
}
```

Create `src/state/state-types.ts`:

```typescript
export interface QueueItem {
  index: number;
  status: "pending" | "opened" | "failed" | "skipped";
  record: Record<string, unknown>;
  opened_at: string | null;
  error: string | null;
}
```

Create `src/state/queue-store.ts`:

```typescript
import { readArtifact } from "../artifacts/read.js";
import { writeArtifactAtomic } from "../artifacts/write.js";

export function readQueue(file: string): unknown {
  return readArtifact(file);
}

export function writeQueue(file: string, queue: unknown): void {
  writeArtifactAtomic(file, queue);
}
```

Create `src/state/run-store.ts`:

```typescript
import { runArtifactPath } from "../artifacts/paths.js";
import { writeArtifactAtomic } from "../artifacts/write.js";

export function writeRunArtifact(root: string, runId: string, fileName: string, artifact: unknown): string {
  const file = runArtifactPath(root, runId, fileName);
  writeArtifactAtomic(file, artifact);
  return file;
}
```

- [ ] **Step 3: Bridge ledger into existing opened-state**

Modify `src/state/opened-state.mjs`:

- Load `.tmp/job_board_harness/state/open_ledger.jsonl` if present.
- Add each event `identity_keys` to the in-memory opened key set.
- Continue reading old `opened_ids.txt`, `opened_urls.txt`, `opened_keys.txt`, and historical receipts.

- [ ] **Step 4: Verify queue recovery**

Run:

```powershell
npm run build
node --test .\test\unit\open-ledger.test.mjs .\test\unit\opened-state.test.mjs .\test\integration\state-recovery.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src\state src\batch test\unit\open-ledger.test.mjs test\integration\state-recovery.test.mjs
git commit -m "feat: add open ledger recovery state"
```

## Task 12: Migrate Open/Open-Batches With Strict External-Action Guard

**Files:**

- Create: `src/browser/tab-opener.ts`
- Create: `src/core/use-cases/open-batches.ts`
- Modify: `src/cli/commands/open.ts`
- Modify: `src/cli/commands/open-batches.ts`
- Modify: `src/cli/runtime.mjs`
- Modify: `test/unit/contact-actions.test.mjs`
- Create: `test/unit/use-case-open-batches.test.mjs`

- [ ] **Step 1: Write failing open-batches guard test**

Create `test/unit/use-case-open-batches.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { planOpenBatch } from "../../dist/core/use-cases/open-batches.js";

test("open batch dry-run never requests browser mutation", () => {
  const result = planOpenBatch({
    queue: { items: [{ index: 0, status: "pending", record: { id: "job-1", url: "https://www.zhipin.com/job_detail/job-1.html" } }] },
    openedKeys: new Set(),
    options: { dryRun: true, maxPerBatch: 10, triggerContact: false },
  });
  assert.equal(result.category, "success");
  assert.equal(result.payload.toOpen.length, 1);
  assert.equal(result.payload.browserMutationAllowed, false);
});

test("trigger contact is blocked without explicit allowExternalAction", () => {
  const result = planOpenBatch({
    queue: { items: [{ index: 0, status: "pending", record: { id: "job-1", url: "https://www.zhipin.com/job_detail/job-1.html" } }] },
    openedKeys: new Set(),
    options: { dryRun: false, maxPerBatch: 10, triggerContact: true, allowExternalAction: false },
  });
  assert.equal(result.category, "external_action_blocked");
  assert.equal(result.exitCode, 5);
});
```

- [ ] **Step 2: Implement open-batches planning**

Create `src/core/use-cases/open-batches.ts`:

```typescript
import { makeCommandResult } from "../../cli/command-result.js";

export function planOpenBatch(input: {
  queue: { items: Array<{ index: number; status: string; record: Record<string, unknown> }> };
  openedKeys: Set<string>;
  options: { dryRun: boolean; maxPerBatch: number; triggerContact: boolean; allowExternalAction?: boolean };
}) {
  if (input.options.triggerContact && !input.options.allowExternalAction) {
    return makeCommandResult({
      category: "external_action_blocked",
      message: "Contact trigger requires explicit external-action permission.",
      payload: { triggerContact: true },
      nextAction: "Ask the user to confirm contact triggering for selected records.",
    });
  }
  const pending = input.queue.items.filter((item) => item.status === "pending");
  const toOpen = pending.slice(0, input.options.maxPerBatch).map((item) => item.record);
  return makeCommandResult({
    category: "success",
    message: "Open batch planned.",
    payload: {
      toOpen,
      browserMutationAllowed: !input.options.dryRun,
    },
  });
}
```

Create `src/browser/tab-opener.ts` by moving `openBackgroundTabs()` from `runtime.mjs`. Preserve:

- background tabs only;
- delay/cooldown/jitter;
- access-limit inspection after open;
- contact verification stays strict;
- uncertain contact pages remain open.

- [ ] **Step 3: Switch command handlers**

Modify:

```text
src/cli/commands/open.ts
src/cli/commands/open-batches.ts
```

Keep compatibility:

- `--dry-run` must not open browser.
- `--trigger-contact` must require explicit user command flag and verification.
- `--resume` must recheck ledger/opened state before opening.
- duplicates must be rejected before browser mutation.

- [ ] **Step 4: Verify no accidental external actions**

Run:

```powershell
npm run build
node --test .\test\unit\use-case-open-batches.test.mjs .\test\unit\contact-actions.test.mjs .\test\unit\opened-state.test.mjs .\test\unit\mock-cdp.test.mjs
node .\tools\job_board_harness.mjs open-batches --queue .tmp\job_board_harness\runs\fixture_boss-search-normal_20260517_112739\open_queue.json --dry-run
```

Expected:

- Tests PASS.
- Dry-run prints planned records and does not open browser tabs.
- If the fixture queue path differs, rerun `test-fixture --fixture boss-search-normal --profile ai-agent-dev --dry-run` and use its printed `open_queue` path.

- [ ] **Step 5: Commit**

```powershell
git add src\browser\tab-opener.ts src\core\use-cases\open-batches.ts src\cli\commands\open.ts src\cli\commands\open-batches.ts src\cli\runtime.mjs test\unit\use-case-open-batches.test.mjs test\unit\contact-actions.test.mjs
git commit -m "refactor: migrate open batch planning and guards"
```

## Task 13: Build Run Pipeline Stage Graph

**Files:**

- Create: `src/core/pipeline/stage-result.ts`
- Create: `src/core/pipeline/stage-graph.ts`
- Create: `src/core/pipeline/run-pipeline.ts`
- Modify: `src/cli/commands/run.ts`
- Modify: `test/contracts/run-pipeline-contract.test.mjs`
- Create: `test/unit/run-pipeline.test.mjs`

- [ ] **Step 1: Write stage graph tests**

Create `test/unit/run-pipeline.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { defaultStageGraph, resolveStageGraph } from "../../dist/core/pipeline/stage-graph.js";

test("default run graph includes detail extraction and second ranking", () => {
  assert.deepEqual(defaultStageGraph(), [
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

test("skip details removes both detail extraction and rank details", () => {
  assert.deepEqual(resolveStageGraph({ skipDetails: true }), [
    "auth",
    "collect",
    "rank_candidates",
    "agent_review",
    "select",
    "open_batches",
  ]);
});
```

- [ ] **Step 2: Implement pipeline types**

Create `src/core/pipeline/stage-result.ts`:

```typescript
export type PipelineStage =
  | "auth"
  | "collect"
  | "rank_candidates"
  | "extract_details"
  | "rank_details"
  | "agent_review"
  | "select"
  | "open_batches";

export interface StageExecutionResult {
  stage: PipelineStage;
  status: "passed" | "failed" | "skipped" | "blocked";
  exitCode: 0 | 1 | 2 | 3 | 4 | 5;
  outputArtifacts: string[];
  warnings: string[];
}
```

Create `src/core/pipeline/stage-graph.ts`:

```typescript
import type { PipelineStage } from "./stage-result.js";

export function defaultStageGraph(): PipelineStage[] {
  return [
    "auth",
    "collect",
    "rank_candidates",
    "extract_details",
    "rank_details",
    "agent_review",
    "select",
    "open_batches",
  ];
}

export function resolveStageGraph(options: { skipDetails?: boolean }): PipelineStage[] {
  if (!options.skipDetails) return defaultStageGraph();
  return [
    "auth",
    "collect",
    "rank_candidates",
    "agent_review",
    "select",
    "open_batches",
  ];
}
```

Create `src/core/pipeline/run-pipeline.ts`:

```typescript
import { makeCommandResult } from "../../cli/command-result.js";
import { resolveStageGraph } from "./stage-graph.js";

export function planPipeline(input: { skipDetails?: boolean; dryRun?: boolean }) {
  const stages = resolveStageGraph({ skipDetails: input.skipDetails });
  return makeCommandResult({
    category: "success",
    message: input.dryRun ? "Pipeline dry-run planned." : "Pipeline planned.",
    payload: { plan: stages, dryRun: Boolean(input.dryRun) },
  });
}
```

- [ ] **Step 3: Switch `run` command in dry-run mode first**

Modify `src/cli/commands/run.ts`:

- `--dry-run` uses typed `planPipeline()`.
- non-dry-run may delegate to legacy until all stage use cases are migrated.
- output must continue satisfying `test/contracts/run-pipeline-contract.test.mjs`.

- [ ] **Step 4: Replace child-process orchestration**

After all stage handlers are typed, replace runtime child-process chaining with in-process calls:

```text
auth -> collect -> rank_candidates -> extract_details -> rank_details -> agent_review -> select -> open_batches
```

For each stage, write:

- `stage_results.jsonl` event;
- output artifact path;
- warnings;
- exit category;
- `requires_user_action`;
- `recoverable`;
- `next_action`.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run build
node --test .\test\unit\run-pipeline.test.mjs .\test\contracts\run-pipeline-contract.test.mjs
node .\tools\job_board_harness.mjs run --profile ai-agent-dev --fixture boss-search-normal --run-id typed_pipeline_fixture --dry-run
npm test
```

Expected:

- Dry-run fixture writes pipeline artifacts without live browser.
- `open_batches` stage stays dry-run unless explicitly permitted.

- [ ] **Step 6: Commit**

```powershell
git add src\core\pipeline src\cli\commands\run.ts test\unit\run-pipeline.test.mjs test\contracts\run-pipeline-contract.test.mjs
git commit -m "feat: add typed run pipeline stage graph"
```

## Task 14: Prompt Contract V2 And Injection Hardening

**Files:**

- Modify: `src/agent/prompt-contracts.mjs`
- Modify: `src/agent/review-runner.mjs`
- Create: `src/security/prompt-injection-policy.ts`
- Modify: `test/unit/agent-contracts.test.mjs`
- Modify: `docs/codex-agent-workflow.md`

- [ ] **Step 1: Add failing prompt contract tests**

Add to `test/unit/agent-contracts.test.mjs`:

```javascript
test("agent review V2 allows needs_more_info but forbids execution directives", () => {
  const valid = validateAgentReviewOutput({
    selection: [{
      id: "candidate-1",
      decision: "needs_more_info",
      confidence: "medium",
      fit_summary: "AI Agent overlap is strong but salary is missing.",
      reason: "Missing salary and team scope.",
      matched_evidence: ["AI Agent", "RAG"],
      risk_flags: ["salary_missing"],
      missing_information: ["salary", "team scope"],
      suggested_user_question: "请确认薪资下限和团队方向。",
    }],
  }, { allowedIds: ["candidate-1"] });
  assert.deepEqual(valid.errors, []);

  const invalid = validateAgentReviewOutput({
    selection: [{
      id: "candidate-1",
      decision: "select",
      confidence: "high",
      reason: "打开浏览器并立即沟通 HR",
      risk: "none",
    }],
  }, { allowedIds: ["candidate-1"] });
  assert(invalid.errors.some((error) => /external action|外部动作|must not/i.test(error)));
});
```

- [ ] **Step 2: Implement policy**

Create `src/security/prompt-injection-policy.ts`:

```typescript
const forbiddenActionPatterns = [
  /open\s+(browser|tab|page)/i,
  /send\s+(message|resume|application)/i,
  /apply\s+(to|for)\s+job/i,
  /export\s+(cookie|token|credential|password)/i,
  /触发.*沟通/,
  /立即沟通/,
  /发送.*消息/,
  /投递.*岗位/,
  /导出.*(cookie|token|凭据|密码)/i,
];

export function containsForbiddenExternalAction(text: string): boolean {
  return forbiddenActionPatterns.some((pattern) => pattern.test(text));
}
```

Modify `src/agent/prompt-contracts.mjs`:

- Add `needs_more_info`.
- Require `fit_summary`, `matched_evidence`, and `risk_flags`.
- Allow `missing_information`, `suggested_user_question`, and `profile_patch_suggestion`.
- Reject forbidden actions in both Chinese and English.
- Reject invented ids as current tests already require.

- [ ] **Step 3: Verify agent boundary**

Run:

```powershell
npm run build
node --test .\test\unit\agent-contracts.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src\agent src\security\prompt-injection-policy.ts test\unit\agent-contracts.test.mjs docs\codex-agent-workflow.md
git commit -m "feat: harden agent judgment contract"
```

## Task 15: Runtime Shrink And Wrapper Switch

**Files:**

- Modify: `tools/job_board_harness.mjs`
- Modify: `src/cli/runtime.mjs`
- Modify: `src/cli/legacy-harness.ts`
- Modify: `src/cli/commands/*.ts`
- Create: `test/contracts/runtime-decomposition.test.mjs`
- Modify: `test/unit/job-board-architecture-cli.test.mjs`

- [ ] **Step 1: Write failing runtime decomposition tests**

Create `test/contracts/runtime-decomposition.test.mjs`:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("runtime.mjs no longer owns business logic", () => {
  const file = path.join(ROOT, "src", "cli", "runtime.mjs");
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  assert(text.split(/\r?\n/).length <= 250, "runtime.mjs must be a small compatibility shim");
  for (const forbidden of [
    "function extractionExpression",
    "function authExpression",
    "function detailPageExpression",
    "function scoreRecord",
    "async function openBackgroundTabs",
    "async function cmdRun",
  ]) {
    assert.doesNotMatch(text, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("typed command handlers no longer call legacy harness", () => {
  const dir = path.join(ROOT, "src", "cli", "commands");
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".ts"))) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    assert.doesNotMatch(text, /runLegacyHarness|legacy-harness/i, `${file} still calls legacy`);
  }
});

test("tools entrypoint uses built TypeScript CLI", () => {
  const text = fs.readFileSync(path.join(ROOT, "tools", "job_board_harness.mjs"), "utf8");
  assert.match(text, /\.\.\/dist\/cli\/main\.js/);
  assert.doesNotMatch(text, /\.\.\/src\/cli\/runtime\.mjs/);
});
```

- [ ] **Step 2: Run failing decomposition test**

Run:

```powershell
node --test .\test\contracts\runtime-decomposition.test.mjs
```

Expected: FAIL until all commands are migrated and wrapper is switched.

- [ ] **Step 3: Switch wrapper only after parity**

Modify `tools/job_board_harness.mjs`:

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

Keep `src/cli/runtime.mjs` for one release as:

```javascript
import { main } from "../../dist/cli/main.js";

export { main };
```

Delete `src/cli/legacy-harness.ts` after every `src/cli/commands/*.ts` has a typed handler.

- [ ] **Step 4: Verify complete parity**

Run:

```powershell
npm run build
node --test .\test\contracts\runtime-decomposition.test.mjs
npm test
node .\tools\job_board_harness.mjs doctor
node .\tools\job_board_harness.mjs auth --site both --reuse-page --no-open-login
node .\tools\job_board_harness.mjs run --profile ai-agent-dev --fixture boss-search-normal --run-id final_typed_fixture --dry-run
```

Expected:

- Build passes.
- All automated tests pass.
- Live doctor/auth are stable.
- Fixture run writes the expected artifacts and does not open browser tabs.

- [ ] **Step 5: Commit**

```powershell
git add tools\job_board_harness.mjs src\cli test\contracts\runtime-decomposition.test.mjs test\unit\job-board-architecture-cli.test.mjs
git commit -m "refactor: switch harness entrypoint to typed CLI"
```

## Task 16: Documentation And Local Tooling Governance

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/browser-automation-stack.md`
- Modify: `docs/harness-contracts.md`
- Modify: `docs/codex-local-tooling.md`
- Optional create after implementation: `skills/job-board-harness-operator/SKILL.md`

- [ ] **Step 1: Update architecture docs**

Required facts for `docs/architecture.md`:

```markdown
The current harness architecture is TypeScript-first:

tools/job_board_harness.mjs -> dist/cli/main.js -> command handler -> use case -> ports/adapters -> artifact/state store.

`src/cli/runtime.mjs` is not the primary runtime. If it exists, it is a compatibility shim only.
```

- [ ] **Step 2: Update testing docs**

Required commands for `docs/testing.md`:

```powershell
npm run typecheck
npm test
npm run test:contracts
node .\tools\job_board_harness.mjs doctor
node .\tools\job_board_harness.mjs auth --site both --reuse-page --no-open-login
node .\tools\job_board_harness.mjs run --profile ai-agent-dev --fixture boss-search-normal --dry-run
```

Document live smoke pass criteria:

- `doctor` reports Edge Beta CDP available.
- `auth` reports logged-in or explicit user-action category.
- `collect` can return zero ranked selections; that is not a collection failure if artifact schema is valid and access limit is false.
- `open-batches --dry-run` must not mutate browser state.

- [ ] **Step 3: Update browser automation docs**

Required phrase for `docs/browser-automation-stack.md`:

```markdown
MCP, Browser plugin, Chrome DevTools, page-agent, OS open, and Playwright-managed browsers are inspection-only for job-board work. They are not fallback control planes for collect, open, open-batches, run, or contact triggering.
```

- [ ] **Step 4: Update local tooling note**

Add to `docs/codex-local-tooling.md`:

```markdown
Conclusion after Harness TypeScript refactor: no new MCP server is needed. The durable local tool is the project harness. A project-local skill may be added only after the TypeScript CLI migration is complete and stable.
```

- [ ] **Step 5: Decide skill promotion**

If all typed migration tasks are complete, create `skills/job-board-harness-operator/SKILL.md` with:

```markdown
# Job Board Harness Operator

Use the project harness for BOSS, Liepin, and 51job screening. Run `doctor` and `auth` before live collection. Use fixtures before live smoke. Do not use MCP, Browser plugin, OS open, Chrome DevTools, page-agent, or Playwright-managed browsers as fallback for collect/open/open-batches/run. Do not trigger contact unless the user explicitly authorizes it.
```

If migration is not complete, do not create the skill; record that conclusion in `docs/codex-local-tooling.md`.

- [ ] **Step 6: Verify docs**

Run:

```powershell
node --test .\test\contracts\harness-contracts.test.mjs .\test\contracts\browser-policy.test.mjs .\test\contracts\no-mcp-fallback.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add docs skills
git commit -m "docs: document typed harness workflow"
```

## Final Verification Route

Run before claiming implementation complete:

```powershell
git status --short --branch
npm run build
npm run typecheck
npm test
node .\tools\job_board_harness.mjs doctor
node .\tools\job_board_harness.mjs auth --site both --reuse-page --no-open-login
node .\tools\job_board_harness.mjs collect --site both --reuse-auth-page --no-open-login --out .tmp\job_board_harness\final_collect_smoke.json
node .\tools\job_board_harness.mjs rank --input .tmp\job_board_harness\final_collect_smoke.json --profile ai-agent-dev --out .tmp\job_board_harness\final_rank_smoke.json
node .\tools\job_board_harness.mjs run --profile ai-agent-dev --fixture boss-search-normal --run-id final_fixture_verify --dry-run
node .\tools\job_board_harness.mjs open-batches --queue .tmp\job_board_harness\runs\final_fixture_verify\open_queue.json --dry-run
git status --short --branch
```

Expected:

- `npm run build` and `npm run typecheck` pass using local TypeScript.
- `npm test` passes.
- `doctor` reports Edge Beta CDP available or a stable `browser_unavailable` typed result.
- `auth` returns both sites authenticated or a stable `auth_required`/`access_limited` typed result.
- `collect` writes a valid artifact; selected count after rank may be zero and should be reviewed as profile-fit data, not harness failure.
- fixture `run --dry-run` writes candidates, ranked, details when enabled, agent review, selection, open queue, run manifest, and summary.
- dry-run `open-batches` does not open browser tabs or trigger contact.
- no tracked secret, cookie, token, browser profile, or `.tmp` live artifact is added.

Optional true external-action verification is intentionally not encoded as a reusable command in this plan. When the user explicitly requests it, first create a fresh live queue in that same execution session, show the selected record count and queue path, then run `open-batches` against that exact queue with `--max-per-batch 10 --cooldown 45000 --jitter 10000`. Do not add `--trigger-contact` unless the user explicitly confirms contact triggering for the selected records. If contact is triggered, success requires strict BOSS “立即沟通” or Liepin “聊一聊” verification; uncertain pages remain open and are recorded as uncertain, not success.

## Self-Review Checklist

- [ ] Every task has concrete files, commands, expected failure, implementation step, verification, and commit command.
- [ ] The plan accounts for current working state: tests pass, TypeScript dependency missing, live Edge Beta CDP is available, BOSS/Liepin are logged in, live rank can reject all candidates.
- [ ] No task requires committing `.tmp` artifacts or credentials.
- [ ] Browser fallback remains prohibited.
- [ ] Runtime migration is gradual and preserves `tools/job_board_harness.mjs` compatibility until wrapper switch.
- [ ] `open-batches` and contact actions remain behind explicit user permission and strict verification.
- [ ] Docs and project-local tooling governance are updated at the end.

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-05-17-harness-typescript-refactor.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using `superpowers:executing-plans`, with checkpoints after each batch.
