import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readArtifact } from "../../dist/artifacts/read.js";
import { writeArtifactAtomic } from "../../dist/artifacts/write.js";

test("artifact store writes JSON atomically and reads it back", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-artifacts-"));
  const file = path.join(dir, "manifest.json");
  const artifact = {
    schema_version: "RunManifest.v1",
    artifact_type: "RunManifest",
    created_at: "2026-05-17T00:00:00.000Z",
    producer: "job-board-harness",
    run_id: "run-test",
    input_artifacts: [],
    meta: {},
    stages: [],
  };
  writeArtifactAtomic(file, artifact);
  assert.deepEqual(readArtifact(file), artifact);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});
