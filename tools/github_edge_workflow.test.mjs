import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const HELPER = path.join(ROOT, "tools", "github_edge_workflow.mjs");

test("GitHub helper documents proxy-backed push workflow", () => {
  const help = execFileSync(process.execPath, [HELPER, "help"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const workflow = execFileSync(process.execPath, [HELPER, "workflow"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  assert.match(help, /configure-proxy/);
  assert.match(help, /push/);
  assert.match(help, /socks5:\/\/127\.0\.0\.1:12334/);
  assert.match(workflow, /GitHub checks use socks5:\/\/127\.0\.0\.1:12334 by default/);
  assert.match(workflow, /github-edge\.cmd push --branch main/);
});
