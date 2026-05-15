import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_BROWSER_CANDIDATES = [
  { exe: "C:\\Program Files (x86)\\Microsoft\\Edge Beta\\Application\\msedge.exe", source: "edge-beta-default" },
  { exe: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", source: "edge-stable-default" },
  { exe: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", source: "chrome-default" },
];

export function defaultBrowserProfile(env = process.env) {
  return path.join(
    env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "Microsoft",
    "Edge Beta",
    "CodexCdpProfile",
  );
}

export function resolveBrowserConfig(root, {
  env = process.env,
  config = {},
  exists = fs.existsSync,
  candidates = DEFAULT_BROWSER_CANDIDATES,
} = {}) {
  const profile = env.JOB_BOARD_BROWSER_PROFILE || config.browser_profile || defaultBrowserProfile(env);
  if (env.JOB_BOARD_BROWSER_EXE) {
    return { exe: env.JOB_BOARD_BROWSER_EXE, source: "JOB_BOARD_BROWSER_EXE", exists: exists(env.JOB_BOARD_BROWSER_EXE), profile };
  }
  if (config.browser_exe) {
    return { exe: config.browser_exe, source: "config.browser_exe", exists: exists(config.browser_exe), profile };
  }
  for (const candidate of candidates) {
    if (exists(candidate.exe)) return { ...candidate, exists: true, profile };
  }
  return { ...candidates[0], exists: false, profile };
}
