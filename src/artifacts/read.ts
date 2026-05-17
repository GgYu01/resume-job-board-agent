import fs from "node:fs";

export function readArtifact(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
