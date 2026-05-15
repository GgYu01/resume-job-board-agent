import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resolveBrowserConfig } from "../../src/config/browser-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("resolveBrowserConfig prefers env, then config path, then default candidates", () => {
  const configured = path.join(ROOT, ".tmp", "job_board_harness", "fake-browser.exe");
  fs.mkdirSync(path.dirname(configured), { recursive: true });
  fs.writeFileSync(configured, "", "utf8");

  const fromEnv = resolveBrowserConfig(ROOT, {
    env: { JOB_BOARD_BROWSER_EXE: configured, JOB_BOARD_BROWSER_PROFILE: "C:\\tmp\\profile" },
    exists: (candidate) => candidate === configured,
  });
  assert.equal(fromEnv.exe, configured);
  assert.equal(fromEnv.source, "JOB_BOARD_BROWSER_EXE");
  assert.equal(fromEnv.profile, "C:\\tmp\\profile");

  const fromConfig = resolveBrowserConfig(ROOT, {
    env: {},
    config: { browser_exe: configured, browser_profile: "D:\\profile" },
    exists: (candidate) => candidate === configured,
  });
  assert.equal(fromConfig.exe, configured);
  assert.equal(fromConfig.source, "config.browser_exe");
  assert.equal(fromConfig.profile, "D:\\profile");
});
