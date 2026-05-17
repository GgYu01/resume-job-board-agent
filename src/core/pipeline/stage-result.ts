export type PipelineStage =
  | "auth"
  | "collect"
  | "rank_candidates"
  | "extract_details"
  | "rank_details"
  | "agent_review"
  | "select"
  | "open_batches";

export interface StageExecutionResult {
  stage: PipelineStage;
  status: "passed" | "failed" | "skipped" | "blocked";
  exitCode: 0 | 1 | 2 | 3 | 4 | 5;
  outputArtifacts: string[];
  warnings: string[];
}
