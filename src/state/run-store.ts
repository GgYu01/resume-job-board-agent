import { runArtifactPath } from "../artifacts/paths.js";
import { writeArtifactAtomic } from "../artifacts/write.js";

export function writeRunArtifact(root: string, runId: string, fileName: string, artifact: unknown): string {
  const file = runArtifactPath(root, runId, fileName);
  writeArtifactAtomic(file, artifact);
  return file;
}
