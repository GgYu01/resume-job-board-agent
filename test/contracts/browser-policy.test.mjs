import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resolveBrowserConfig } from "../../src/config/browser-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

const EDGE_BETA_EXE = "C:\\Program Files (x86)\\Microsoft\\Edge Beta\\Application\\msedge.exe";
const EDGE_STABLE_EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

test("default browser policy is strict Edge Beta and does not fall back to Edge stable", () => {
  const resolved = resolveBrowserConfig(ROOT, {
    env: { LOCALAPPDATA: "C:\\Users\\dev\\AppData\\Local" },
    exists: (candidate) => candidate === EDGE_STABLE_EXE,
  });

  assert.equal(resolved.exe, EDGE_BETA_EXE);
  assert.equal(resolved.family, "edge-beta");
  assert.equal(resolved.exists, false);
  assert.equal(resolved.usable, false);
  assert.equal(resolved.policy.required_family, "edge-beta");
  assert.equal(resolved.policy.allow_fallback_family, false);
  assert.match(resolved.problem, /Edge Beta/i);
});

test("explicit non Edge Beta executable is detected but rejected unless fallback is enabled", () => {
  const resolved = resolveBrowserConfig(ROOT, {
    env: { JOB_BOARD_BROWSER_EXE: EDGE_STABLE_EXE },
    exists: (candidate) => candidate === EDGE_STABLE_EXE,
  });

  assert.equal(resolved.exe, EDGE_STABLE_EXE);
  assert.equal(resolved.family, "edge-stable");
  assert.equal(resolved.exists, true);
  assert.equal(resolved.usable, false);
  assert.match(resolved.problem, /requires Edge Beta/i);
});

test("browser policy can explicitly permit another installed family for diagnostics", () => {
  const resolved = resolveBrowserConfig(ROOT, {
    env: {},
    config: { browser_policy: { allow_fallback_family: true } },
    exists: (candidate) => candidate === EDGE_STABLE_EXE,
  });

  assert.equal(resolved.exe, EDGE_STABLE_EXE);
  assert.equal(resolved.family, "edge-stable");
  assert.equal(resolved.exists, true);
  assert.equal(resolved.usable, true);
  assert.equal(resolved.problem, null);
});

test("typed browser policy exposes Edge Beta CDP as the only live adapter", async () => {
  const { createStrictBrowserPolicy } = await import("../../dist/browser/browser-policy.js");
  const policy = createStrictBrowserPolicy();

  assert.equal(policy.requiredFamily, "edge-beta");
  assert.equal(policy.allowFallbackFamily, false);
  assert.equal(policy.requiredControlPlane, "cdp");
  assert.equal(policy.allowManagedBrowser, false);
});
