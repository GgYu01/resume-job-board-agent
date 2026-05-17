import fs from "node:fs";
import path from "node:path";

export function writeArtifactAtomic(file: string, artifact: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}
