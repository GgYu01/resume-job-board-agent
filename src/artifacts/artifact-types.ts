export interface ArtifactBase {
  schema_version: string;
  artifact_type: string;
  created_at: string;
  producer: "job-board-harness";
  run_id?: string;
  input_artifacts: string[];
  meta: Record<string, unknown>;
}

export type StageStatus = "passed" | "failed" | "skipped" | "blocked";

export interface RunStageResult {
  stage: string;
  status: StageStatus;
  exit_code: 0 | 1 | 2 | 3 | 4 | 5;
  started_at: string;
  finished_at: string;
  input_artifacts: string[];
  output_artifacts: string[];
  warnings: string[];
  requires_user_action: boolean;
  recoverable: boolean;
  next_action: string;
}

export interface RunManifest extends ArtifactBase {
  schema_version: "RunManifest.v1";
  artifact_type: "RunManifest";
  run_id: string;
  stages: RunStageResult[];
}
