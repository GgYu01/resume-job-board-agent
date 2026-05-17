import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_BROWSER_CANDIDATES = [
  {
    exe: "C:\\Program Files (x86)\\Microsoft\\Edge Beta\\Application\\msedge.exe",
    source: "edge-beta-default",
    family: "edge-beta",
  },
  {
    exe: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    source: "edge-stable-default",
    family: "edge-stable",
  },
  {
    exe: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    source: "chrome-default",
    family: "chrome",
  },
];

export const DEFAULT_BROWSER_POLICY = {
  required_family: "edge-beta",
  allow_fallback_family: false,
};

export function defaultBrowserProfile(env = process.env) {
  return path.join(
    env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "Microsoft",
    "Edge Beta",
    "CodexCdpProfile",
  );
}

function normalizeBoolean(value, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (/^(true|1|yes|y)$/i.test(value)) return true;
    if (/^(false|0|no|n)$/i.test(value)) return false;
  }
  return Boolean(value);
}

export function normalizeBrowserPolicy(config = {}) {
  const raw = config.browser_policy || {};
  return {
    ...DEFAULT_BROWSER_POLICY,
    required_family: raw.required_family || DEFAULT_BROWSER_POLICY.required_family,
    allow_fallback_family: normalizeBoolean(
      raw.allow_fallback_family,
      DEFAULT_BROWSER_POLICY.allow_fallback_family,
    ),
  };
}

function normalizeExecutable(value) {
  return String(value || "").toLowerCase().replace(/\\/g, "/");
}

export function inferBrowserFamily(exe, candidates = DEFAULT_BROWSER_CANDIDATES) {
  const exact = candidates.find((candidate) => candidate.exe === exe);
  if (exact?.family) return exact.family;

  const normalized = normalizeExecutable(exe);
  if (normalized.includes("/microsoft/edge beta/") || normalized.includes("/edge beta/")) return "edge-beta";
  if (normalized.includes("/microsoft/edge/")) return "edge-stable";
  if (normalized.includes("/google/chrome/")) return "chrome";
  return "unknown";
}

function withPolicyStatus(resolved, policy) {
  if (!resolved.exe) {
    return { ...resolved, policy, usable: false, problem: "Browser executable is not configured." };
  }
  if (!resolved.exists) {
    return {
      ...resolved,
      policy,
      usable: false,
      problem: `Required ${policy.required_family === "edge-beta" ? "Edge Beta" : policy.required_family} browser executable was not found: ${resolved.exe}`,
    };
  }
  if (!policy.allow_fallback_family && resolved.family !== policy.required_family) {
    return {
      ...resolved,
      policy,
      usable: false,
      problem: `Job-board live flow requires Edge Beta CDP, but ${resolved.source} resolved to ${resolved.family}: ${resolved.exe}`,
    };
  }
  return { ...resolved, policy, usable: true, problem: null };
}

function buildExplicitBrowser(exe, source, { exists, candidates, profile, policy }) {
  return withPolicyStatus({
    exe,
    source,
    family: inferBrowserFamily(exe, candidates),
    exists: exists(exe),
    profile,
  }, policy);
}

function findRequiredCandidate(candidates, requiredFamily) {
  return candidates.find((candidate) => candidate.family === requiredFamily) || candidates[0];
}

export function resolveBrowserConfig(root, {
  env = process.env,
  config = {},
  exists = fs.existsSync,
  candidates = DEFAULT_BROWSER_CANDIDATES,
} = {}) {
  const policy = normalizeBrowserPolicy(config);
  const profile = env.JOB_BOARD_BROWSER_PROFILE || config.browser_profile || defaultBrowserProfile(env);
  if (env.JOB_BOARD_BROWSER_EXE) {
    return buildExplicitBrowser(env.JOB_BOARD_BROWSER_EXE, "JOB_BOARD_BROWSER_EXE", { exists, candidates, profile, policy });
  }
  if (config.browser_exe) {
    return buildExplicitBrowser(config.browser_exe, "config.browser_exe", { exists, candidates, profile, policy });
  }

  if (!policy.allow_fallback_family) {
    const required = findRequiredCandidate(candidates, policy.required_family);
    return withPolicyStatus({
      ...required,
      family: required.family || inferBrowserFamily(required.exe, candidates),
      exists: exists(required.exe),
      profile,
    }, policy);
  }

  for (const candidate of candidates) {
    if (exists(candidate.exe)) {
      return withPolicyStatus({
        ...candidate,
        family: candidate.family || inferBrowserFamily(candidate.exe, candidates),
        exists: true,
        profile,
      }, policy);
    }
  }
  const required = findRequiredCandidate(candidates, policy.required_family);
  return withPolicyStatus({
    ...required,
    family: required.family || inferBrowserFamily(required.exe, candidates),
    exists: false,
    profile,
  }, policy);
}
