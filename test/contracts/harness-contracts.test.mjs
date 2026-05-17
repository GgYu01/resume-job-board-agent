import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");

test("harness contracts document the stable architecture boundaries", () => {
  const contractPath = path.join(ROOT, "docs", "harness-contracts.md");
  const text = fs.readFileSync(contractPath, "utf8");

  for (const heading of [
    "Deterministic Harness Boundary",
    "AI Judgment Boundary",
    "Browser Control Contract",
    "Artifact Contract",
    "Error Contract",
    "Verification Contract",
  ]) {
    assert.match(text, new RegExp(`## ${heading}`));
  }

  assert.match(text, /Edge Beta CDP/i);
  assert.match(text, /No MCP fallback/i);
  assert.match(text, /Do not export cookies, passwords, tokens, or browser profile files/i);
});

test("architecture and testing docs link to the harness contracts", () => {
  const architecture = fs.readFileSync(path.join(ROOT, "docs", "architecture.md"), "utf8");
  const testing = fs.readFileSync(path.join(ROOT, "docs", "testing.md"), "utf8");

  assert.match(architecture, /harness-contracts\.md/);
  assert.match(testing, /harness-contracts\.md/);
});
