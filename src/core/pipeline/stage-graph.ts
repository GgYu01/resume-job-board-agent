import type { PipelineStage } from "./stage-result.js";

export function defaultStageGraph(): PipelineStage[] {
  return [
    "auth",
    "collect",
    "rank_candidates",
    "extract_details",
    "rank_details",
    "agent_review",
    "select",
    "open_batches",
  ];
}

export function resolveStageGraph(options: { skipDetails?: boolean }): PipelineStage[] {
  if (!options.skipDetails) return defaultStageGraph();
  return [
    "auth",
    "collect",
    "rank_candidates",
    "agent_review",
    "select",
    "open_batches",
  ];
}
