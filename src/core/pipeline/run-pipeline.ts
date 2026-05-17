import { makeCommandResult } from "../../cli/command-result.js";
import { resolveStageGraph } from "./stage-graph.js";

export function planPipeline(input: { skipDetails?: boolean; dryRun?: boolean }) {
  const stages = resolveStageGraph({ skipDetails: input.skipDetails });
  return makeCommandResult({
    category: "success",
    message: input.dryRun ? "Pipeline dry-run planned." : "Pipeline planned.",
    payload: { plan: stages, dryRun: Boolean(input.dryRun) },
  });
}
