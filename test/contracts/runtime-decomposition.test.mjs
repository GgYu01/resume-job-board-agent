import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("runtime.mjs no longer owns business logic", () => {
  const file = path.join(ROOT, "src", "cli", "runtime.mjs");
  const text = fs.readFileSync(file, "utf8");
  assert(text.split(/\r?\n/).length <= 80, "runtime.mjs must be a small compatibility shim");
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

test("tools entrypoint uses built TypeScript CLI", () => {
  const text = fs.readFileSync(path.join(ROOT, "tools", "job_board_harness.mjs"), "utf8");
  assert.match(text, /\.\.\/dist\/cli\/main\.js/);
  assert.doesNotMatch(text, /\.\.\/src\/cli\/runtime\.mjs/);
});
