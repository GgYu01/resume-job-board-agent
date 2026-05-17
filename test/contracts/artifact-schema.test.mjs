import assert from "node:assert/strict";
import test from "node:test";

import {
  validateArtifactBase,
  validateRunManifest,
} from "../../dist/artifacts/validate.js";

test("artifact base requires versioned local harness envelope", () => {
  const valid = validateArtifactBase({
    schema_version: "CandidateCollection.v1",
    artifact_type: "CandidateCollection",
    created_at: "2026-05-17T00:00:00.000Z",
    producer: "job-board-harness",
    input_artifacts: [],
    meta: {},
  });
  assert.equal(valid.ok, true);

  const invalid = validateArtifactBase({
    artifact_type: "CandidateCollection",
    producer: "job-board-harness",
    input_artifacts: [],
    meta: {},
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /schema_version/);
});

test("run manifest records stage auditability", () => {
  const result = validateRunManifest({
    schema_version: "RunManifest.v1",
    artifact_type: "RunManifest",
    created_at: "2026-05-17T00:00:00.000Z",
    producer: "job-board-harness",
    run_id: "run-test",
    input_artifacts: [],
    meta: {},
    stages: [{
      stage: "auth",
      status: "passed",
      exit_code: 0,
      started_at: "2026-05-17T00:00:00.000Z",
      finished_at: "2026-05-17T00:00:01.000Z",
      input_artifacts: [],
      output_artifacts: [],
      warnings: [],
      requires_user_action: false,
      recoverable: true,
      next_action: "",
    }],
  });
  assert.equal(result.ok, true);
});
