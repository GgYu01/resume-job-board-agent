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
    identity_keys: ["boss:job-1", "sig:ai agent|future ai|shenzhen"],
    record: { id: "job-1" },
    source_artifact: "open_queue.json",
  });

  const loaded = loadOpenLedger(file);
  assert.equal(loaded.events.length, 1);
  assert.equal(loaded.keys.has("boss:job-1"), true);
  assert.equal(loaded.keys.has("sig:ai agent|future ai|shenzhen"), true);
});
