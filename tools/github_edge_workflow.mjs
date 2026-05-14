#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const DEFAULT_OWNER = "GgYu01";
const DEFAULT_REPO = "resume-job-board-agent";
const DEFAULT_LEGACY_REPO = "work_jianli";
const DEFAULT_DESCRIPTION =
  "Resume-driven job-board browser agent workflow for Codex, BOSS Zhipin, and Liepin.";

const EDGE_STABLE_CANDIDATES = [
  process.env.EDGE_STABLE_EXE,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    let value = eq >= 0 ? arg.slice(eq + 1) : true;
    if (eq < 0 && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      value = argv[i + 1];
      i += 1;
    }
    out[key] = value;
  }
  return out;
}

function option(args, key, fallback = undefined) {
  const value = args[key];
  if (value === undefined || value === false) return fallback;
  return value;
}

function boolOption(args, key) {
  return args[key] === true || args[key] === "true" || args[key] === "1";
}

function findEdgeStableExe() {
  for (const candidate of EDGE_STABLE_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  const where = spawnSync("where.exe", ["msedge.exe"], { encoding: "utf8" });
  if (where.status === 0) {
    for (const line of where.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
      if (/\\Microsoft\\Edge\\Application\\msedge\.exe$/i.test(line) && !/Edge Beta/i.test(line)) {
        return line;
      }
    }
  }
  return null;
}

function safeJsonParse(text, fallback) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}

function edgeProcesses() {
  const script = [
    "$rows = @(Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" |",
    "Select-Object ProcessId, ExecutablePath, CommandLine);",
    "$rows | ConvertTo-Json -Depth 3",
  ].join(" ");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) return [];
  const parsed = safeJsonParse(result.stdout, []);
  return (Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean);
}

function edgeSummary() {
  const rows = edgeProcesses();
  const stable = rows.filter((row) =>
    /\\Microsoft\\Edge\\Application\\msedge\.exe$/i.test(row.ExecutablePath || "") &&
    !/Edge Beta/i.test(row.ExecutablePath || row.CommandLine || "")
  );
  const beta = rows.filter((row) => /Edge Beta/i.test(row.ExecutablePath || row.CommandLine || ""));
  return {
    stable: {
      running: stable.length > 0,
      process_count: stable.length,
      pids: stable.map((row) => row.ProcessId).slice(0, 20),
    },
    beta: {
      running: beta.length > 0,
      process_count: beta.length,
    },
  };
}

function runGit(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function gitState() {
  return {
    branch: runGit(["branch", "--show-current"]).stdout || null,
    remote_origin: runGit(["config", "--get", "remote.origin.url"]).stdout || null,
    head: runGit(["log", "--oneline", "-1"]).stdout || null,
  };
}

async function repoStatus(owner, repo) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "codex-local-github-edge-helper" },
    });
    return { full_name: `${owner}/${repo}`, http_status: response.status, exists: response.status === 200 };
  } catch (error) {
    return { full_name: `${owner}/${repo}`, error: error.message, exists: null };
  } finally {
    clearTimeout(timer);
  }
}

function createRepoUrl(args) {
  const owner = option(args, "owner", DEFAULT_OWNER);
  const repo = option(args, "repo", DEFAULT_REPO);
  const description = option(args, "description", DEFAULT_DESCRIPTION);
  const visibility = option(args, "visibility", "public");
  const url = new URL("https://github.com/new");
  url.searchParams.set("owner", owner);
  url.searchParams.set("name", repo);
  url.searchParams.set("description", description);
  url.searchParams.set("visibility", visibility);
  return url.href;
}

function repoUrl(args, repoKey = "repo") {
  const owner = option(args, "owner", DEFAULT_OWNER);
  const repo = option(args, repoKey, repoKey === "legacy-repo" ? DEFAULT_LEGACY_REPO : DEFAULT_REPO);
  return `https://github.com/${owner}/${repo}`;
}

function deleteSettingsUrl(args) {
  return `${repoUrl(args, "legacy-repo")}/settings#danger-zone`;
}

function openInEdgeStable(url, { allowLaunch = true } = {}) {
  const exe = findEdgeStableExe();
  if (!exe) throw new Error("Microsoft Edge stable executable was not found.");
  const before = edgeSummary();
  if (!before.stable.running && !allowLaunch) {
    throw new Error("Edge stable is not running. Start Edge stable first, or omit --require-running.");
  }
  const child = spawn(exe, ["--new-tab", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  return {
    edge_exe: exe,
    reused_existing_edge_stable: before.stable.running,
    opened_url: url,
    note:
      "This uses the normal Edge stable profile and does not export cookies, passwords, or tokens.",
  };
}

async function cmdStatus(args) {
  const owner = option(args, "owner", DEFAULT_OWNER);
  const repo = option(args, "repo", DEFAULT_REPO);
  const legacyRepo = option(args, "legacy-repo", DEFAULT_LEGACY_REPO);
  const [target, legacy] = await Promise.all([
    repoStatus(owner, repo),
    repoStatus(owner, legacyRepo),
  ]);
  console.log(JSON.stringify({
    edge: {
      stable_exe: findEdgeStableExe(),
      ...edgeSummary(),
    },
    git: gitState(),
    repositories: {
      target,
      legacy,
    },
  }, null, 2));
}

function cmdOpenCreate(args) {
  console.log(JSON.stringify(openInEdgeStable(createRepoUrl(args), {
    allowLaunch: !boolOption(args, "require-running"),
  }), null, 2));
}

function cmdOpenTarget(args) {
  console.log(JSON.stringify(openInEdgeStable(repoUrl(args, "repo"), {
    allowLaunch: !boolOption(args, "require-running"),
  }), null, 2));
}

function cmdOpenDeleteLegacy(args) {
  console.log(JSON.stringify(openInEdgeStable(deleteSettingsUrl(args), {
    allowLaunch: !boolOption(args, "require-running"),
  }), null, 2));
}

function cmdWorkflow() {
  console.log(`GitHub Edge stable workflow

Purpose:
  Use Microsoft Edge stable, not Edge Beta, for GitHub. This reuses the user's
  normal Edge profile, network path, and GitHub login state.

Default target:
  GgYu01/resume-job-board-agent

Commands:
  .\\tools\\github-edge.cmd status
  .\\tools\\github-edge.cmd open-create
  .\\tools\\github-edge.cmd open-delete-legacy
  .\\tools\\github-edge.cmd open-target

Recommended flow:
  1. Run status and confirm Edge stable is running.
  2. Run open-create. Complete GitHub's create-repository form in Edge if it is not fully prefilled.
  3. If GgYu01/work_jianli exists, run open-delete-legacy and confirm deletion manually in GitHub.
  4. After the target repo exists, run:
       git push -u origin main

Boundaries:
  - This helper does not read or export cookies, passwords, tokens, or browser profile files.
  - Repository deletion remains a manual GitHub confirmation unless a separate authenticated GitHub API token is explicitly provided by the user.
  - If a future agent needs DOM-level automation, enable the Playwriter/PageAgent extension on the Edge stable GitHub tab.
`);
}

function cmdHelp() {
  console.log(`Usage: github-edge <command> [options]

Commands:
  status                 Check Edge stable process, git remote, and target repo existence
  open-create            Open GitHub's new-repository page in Edge stable
  open-delete-legacy     Open legacy repository Settings/Danger Zone in Edge stable
  open-target            Open the target repository URL in Edge stable
  workflow               Print the recommended GitHub workflow

Options:
  --owner GgYu01
  --repo resume-job-board-agent
  --legacy-repo work_jianli
  --description "..."
  --visibility public
  --require-running      Refuse to launch Edge if Edge stable is not already running
`);
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (command) {
    case "status":
      await cmdStatus(args);
      break;
    case "open-create":
      cmdOpenCreate(args);
      break;
    case "open-delete-legacy":
      cmdOpenDeleteLegacy(args);
      break;
    case "open-target":
      cmdOpenTarget(args);
      break;
    case "workflow":
      cmdWorkflow();
      break;
    case "help":
    case "--help":
    case "-h":
      cmdHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
