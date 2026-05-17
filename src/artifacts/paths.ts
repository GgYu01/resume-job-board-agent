import path from "node:path";

export function runArtifactPath(root: string, runId: string, fileName: string): string {
  return path.join(root, ".tmp", "job_board_harness", "runs", runId, fileName);
}
