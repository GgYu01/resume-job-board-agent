import { readArtifact } from "../artifacts/read.js";
import { writeArtifactAtomic } from "../artifacts/write.js";

export function readQueue(file: string): unknown {
  return readArtifact(file);
}

export function writeQueue(file: string, queue: unknown): void {
  writeArtifactAtomic(file, queue);
}
