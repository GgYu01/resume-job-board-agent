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

test("auth summary blocks on login-required sites", () => {
  const result = summarizeAuthResults([
    { site: "boss", status: "login-required", accessLimited: false },
  ]);

  assert.equal(result.category, "auth_required");
  assert.equal(result.exitCode, 3);
});
