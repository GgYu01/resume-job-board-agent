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

test("doctor reports success when browser doctor is available", async () => {
  const result = await runDoctor({
    browser: { doctor: async () => ({ available: true, endpoint: { port: 9222, browser: "Edg/test" } }) },
    now: () => "2026-05-17T00:00:00.000Z",
  });

  assert.equal(result.category, "success");
  assert.equal(result.exitCode, 0);
});
