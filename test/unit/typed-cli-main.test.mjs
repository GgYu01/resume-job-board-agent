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
