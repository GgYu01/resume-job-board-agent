import fs from "node:fs";
import path from "node:path";

export function stateDir(root) {
  return path.resolve(root, ".tmp", "job_board_harness");
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function runId(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `run_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function runDir(root, id = runId()) {
  return path.join(stateDir(root), "runs", id);
}

export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return file;
}
