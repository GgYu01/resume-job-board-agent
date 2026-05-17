import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { alreadyOpened, loadOpenedState } from "../../src/state/opened-state.mjs";

test("opened state loads semantic keys from open ledger jsonl", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "opened-state-ledger-"));
  fs.mkdirSync(path.join(stateDir, "state"), { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "state", "open_ledger.jsonl"),
    `${JSON.stringify({
      schema_version: "OpenLedgerEvent.v1",
      created_at: "2026-05-17T00:00:00.000Z",
      action: "opened",
      identity_keys: ["sig:senior ai agent engineer|future ai|shenzhen"],
      record: { title: "Senior AI Agent Engineer", company: "Future AI", location: "Shenzhen" },
      source_artifact: "open_queue.json",
    })}\n`,
    "utf8",
  );

  const state = loadOpenedState(stateDir);
  assert.equal(alreadyOpened({
    title: "Senior AI Agent Engineer",
    company: "Future AI",
    location: "Shenzhen",
    url: "https://www.zhipin.com/job_detail/new-id.html",
  }, state), true);
});
