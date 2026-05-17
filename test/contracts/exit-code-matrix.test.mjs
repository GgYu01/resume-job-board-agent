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
