#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const STATE_DIR = path.join(ROOT, ".tmp", "job_board_harness");
const DEFAULT_PORTS = Array.from({ length: 9 }, (_, i) => 9222 + i);
const DEFAULT_MAX_BATCH = 15;

const EDGE_BETA_EXE =
  "C:\\Program Files (x86)\\Microsoft\\Edge Beta\\Application\\msedge.exe";
const EDGE_CDP_PROFILE_PATH = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "Microsoft",
  "Edge Beta",
  "CodexCdpProfile",
);
const EDGE_CDP_PROFILE =
  EDGE_CDP_PROFILE_PATH;

const AUTH_SITES = {
  liepin: {
    label: "Liepin",
    checkUrl: "https://www.liepin.com/zhaopin/?key=AI%20Agent",
    reloginUrl: "https://www.liepin.com/",
    hostRe: /liepin\.com/i,
  },
  boss: {
    label: "BOSS Zhipin",
    checkUrl: "https://www.zhipin.com/web/geek/jobs",
    reloginUrl: "https://www.zhipin.com/web/geek/jobs",
    hostRe: /zhipin\.com/i,
  },
};

const SITE_PATTERNS = {
  liepin: {
    host: "liepin.com",
    detail: /https?:\/\/(?:www\.)?liepin\.com\/((?:job|a)\/(\d+)\.shtml)/i,
  },
  boss: {
    host: "zhipin.com",
    detail: /https?:\/\/(?:www\.)?zhipin\.com\/job_detail\/([^/?#]+)\.html/i,
  },
};

const DEFAULT_POSITIVE_TERMS = [
  ["AI Agent", 18],
  ["Agent", 8],
  ["LLM", 12],
  ["RAG", 12],
  ["MCP", 12],
  ["AIGC", 8],
  ["OpenAI", 10],
  ["Codex", 10],
  ["Cursor", 8],
  ["Claude", 8],
  ["大模型", 12],
  ["智能体", 14],
  ["模型部署", 12],
  ["提示词", 6],
  ["工程化", 8],
  ["嵌入式", 14],
  ["Linux", 12],
  ["Android", 10],
  ["驱动", 14],
  ["内核", 10],
  ["MTK", 12],
  ["高通", 10],
  ["Qualcomm", 10],
  ["Hypervisor", 14],
  ["virtio", 14],
  ["vsock", 14],
  ["AUTOSAR", 10],
  ["C++", 8],
  ["Python", 8],
  ["DevOps", 12],
  ["SRE", 10],
  ["K8s", 12],
  ["Kubernetes", 12],
  ["Docker", 8],
  ["Jenkins", 8],
  ["Argo", 8],
  ["Helm", 8],
  ["Terraform", 8],
  ["Prometheus", 8],
  ["Grafana", 8],
  ["云原生", 10],
  ["运维开发", 12],
  ["平台工程", 10],
  ["自动化", 8],
  ["系统运维", 8],
  ["机房", 7],
  ["网络", 5],
];

const DEFAULT_NEGATIVE_TERMS = [
  ["销售", 18],
  ["客服", 18],
  ["人事", 18],
  ["HR", 16],
  ["招聘", 16],
  ["行政", 18],
  ["财务", 18],
  ["会计", 18],
  ["审计", 18],
  ["市场", 14],
  ["营销", 14],
  ["电商运营", 16],
  ["运营专员", 16],
  ["产品经理", 10],
  ["讲师", 16],
  ["教师", 16],
  ["培训", 14],
  ["实习", 14],
  ["兼职", 18],
  ["车身电子", 10],
];

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

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
    if (out[key] === undefined) out[key] = value;
    else if (Array.isArray(out[key])) out[key].push(value);
    else out[key] = [out[key], value];
  }
  return out;
}

function values(args, key) {
  const v = args[key];
  if (v === undefined || v === true || v === false) return [];
  return Array.isArray(v) ? v : [v];
}

function option(args, key, fallback = undefined) {
  const v = args[key];
  if (v === undefined || v === false) return fallback;
  return Array.isArray(v) ? v[v.length - 1] : v;
}

function boolOption(args, key) {
  return args[key] === true || args[key] === "true" || args[key] === "1";
}

function intOption(args, key, fallback) {
  const v = option(args, key, undefined);
  if (v === undefined || v === true) return fallback;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function splitTerms(valuesIn) {
  const out = [];
  for (const value of valuesIn) {
    for (const part of String(value).split(/[,\n;|，、]/u)) {
      const term = part.trim();
      if (term) out.push(term);
    }
  }
  return out;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function includesTerm(text, term) {
  if (!term) return false;
  return text.toLowerCase().includes(String(term).toLowerCase());
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canonicalJobUrl(input) {
  let url = String(input || "").trim();
  if (!url) return null;
  try {
    url = new URL(url).href;
  } catch {
    return null;
  }
  for (const [site, cfg] of Object.entries(SITE_PATTERNS)) {
    const m = url.match(cfg.detail);
    if (!m) continue;
    if (site === "liepin") {
      return { site, id: m[2], url: `https://www.liepin.com/${m[1]}` };
    }
    if (site === "boss") {
      return { site, id: m[1], url: `https://www.zhipin.com/job_detail/${m[1]}.html` };
    }
  }
  return null;
}

function recordKey(record) {
  const canonical = canonicalJobUrl(record.url || record.href || "");
  if (canonical) return `${canonical.site}:${canonical.id}`;
  return String(record.url || record.href || "").trim();
}

async function fetchJson(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function probePort(port) {
  try {
    const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
    if (!version.webSocketDebuggerUrl) return null;
    return { port, version };
  } catch {
    return null;
  }
}

async function resolveCdpPort(args) {
  const explicit = intOption(args, "port", null);
  const ports = explicit ? [explicit] : DEFAULT_PORTS;
  for (const port of ports) {
    const hit = await probePort(port);
    if (hit) return hit;
  }
  return null;
}

async function waitForCdp(port, timeoutMs = 9000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = await probePort(port);
    if (hit) return hit;
    await delay(500);
  }
  return null;
}

async function startEdgeCdp(port = 9222) {
  if (!fs.existsSync(EDGE_BETA_EXE)) {
    throw new Error(`Edge Beta executable not found: ${EDGE_BETA_EXE}`);
  }
  fs.mkdirSync(EDGE_CDP_PROFILE_PATH, { recursive: true });
  const args = [
    `--remote-debugging-port=${port}`,
    `--remote-allow-origins=http://127.0.0.1:${port}`,
    `--user-data-dir=${EDGE_CDP_PROFILE_PATH}`,
    "about:blank",
  ];
  const child = spawn(EDGE_BETA_EXE, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  const hit = await waitForCdp(port);
  if (!hit) {
    throw new Error(`Started Edge Beta but CDP did not become available on port ${port}`);
  }
  return hit;
}

async function ensureCdp(args, { start = false } = {}) {
  let hit = await resolveCdpPort(args);
  if (hit || !start) return hit;
  const port = intOption(args, "port", 9222);
  return await startEdgeCdp(port);
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      const fail = (event) => {
        reject(new Error(`CDP WebSocket error: ${event?.message || "open failed"}`));
      };
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", fail, { once: true });
      this.ws.addEventListener("message", (event) => this.onMessage(event));
      this.ws.addEventListener("close", () => {
        for (const { reject: rejectPending } of this.pending.values()) {
          rejectPending(new Error("CDP WebSocket closed"));
        }
        this.pending.clear();
      });
    });
  }

  onMessage(event) {
    let raw = event.data;
    if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
    const msg = JSON.parse(String(raw));
    if (!msg.id || !this.pending.has(msg.id)) return;
    const { resolve, reject } = this.pending.get(msg.id);
    this.pending.delete(msg.id);
    if (msg.error) reject(new Error(`${msg.error.message || "CDP error"} (${msg.error.code})`));
    else resolve(msg.result);
  }

  send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("CDP WebSocket is not open"));
    }
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
  }
}

async function listTargets(port) {
  return await fetchJson(`http://127.0.0.1:${port}/json/list`, 2500);
}

function siteMatches(url, site) {
  if (!url) return false;
  if (site === "both") {
    return /liepin\.com|zhipin\.com/i.test(url);
  }
  const cfg = SITE_PATTERNS[site];
  return cfg ? new RegExp(cfg.host, "i").test(url) : true;
}

function extractionExpression(site) {
  const siteLiteral = JSON.stringify(site);
  return `(() => {
    const wantedSite = ${siteLiteral};
    const norm = (s) => String(s || "")
      .replace(/\\u00a0/g, " ")
      .replace(/[ \\t]+/g, " ")
      .replace(/\\n{3,}/g, "\\n\\n")
      .trim();
    const canon = (href) => {
      let url = "";
      try { url = new URL(href, location.href).href; } catch (e) { return null; }
      let m = url.match(/https?:\\/\\/(?:www\\.)?liepin\\.com\\/((?:job|a)\\/(\\d+)\\.shtml)/i);
      if (m && (wantedSite === "both" || wantedSite === "liepin")) {
        return { site: "liepin", id: m[2], url: "https://www.liepin.com/" + m[1] };
      }
      m = url.match(/https?:\\/\\/(?:www\\.)?zhipin\\.com\\/job_detail\\/([^/?#]+)\\.html/i);
      if (m && (wantedSite === "both" || wantedSite === "boss")) {
        return { site: "boss", id: m[1], url: "https://www.zhipin.com/job_detail/" + m[1] + ".html" };
      }
      return null;
    };
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    const items = [];
    for (const a of anchors) {
      const c = canon(a.href);
      if (!c) continue;
      let best = "";
      let el = a;
      for (let depth = 0; el && depth < 8; depth += 1, el = el.parentElement) {
        const text = norm(el.innerText || el.textContent || "");
        if (text.length > best.length && text.length < 1200) best = text;
        if (text.length > 40 && text.length < 700 && /k|K|薪|经验|本科|猎头|HR|在线|沟通|BOSS|职位|岗位/.test(text)) {
          best = text;
          break;
        }
      }
      items.push({
        site: c.site,
        id: c.id,
        url: c.url,
        titleText: norm(a.innerText || a.textContent || ""),
        cardText: best,
        sourceUrl: location.href,
        sourceTitle: document.title || "",
      });
    }
    const body = norm(document.body ? document.body.innerText : "");
    const accessLimited = /安全验证|验证码|访问过于频繁|captcha|verify|验证/.test(body) ||
      /safe\\.liepin\\.com|verify\\.zhipin\\.com|captcha/.test(location.href);
    return JSON.stringify({
      url: location.href,
      title: document.title || "",
      bodySample: body.slice(0, 1500),
      accessLimited,
      items,
    });
  })()`;
}

async function evaluateTarget(target, expression) {
  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.connect();
  try {
    const result = await session.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    const value = result?.result?.value;
    return typeof value === "string" ? JSON.parse(value) : value;
  } finally {
    session.close();
  }
}

function authExpression() {
  return `(() => {
    const norm = (s) => String(s || "")
      .replace(/\\u00a0/g, " ")
      .replace(/[ \\t]+/g, " ")
      .replace(/\\n{3,}/g, "\\n\\n")
      .trim();
    const text = norm(document.body ? document.body.innerText : "");
    const all = text + " " + location.href + " " + (document.title || "");
    const loginRequired = /\\u767b\\u5f55|\\u6ce8\\u518c|\\u626b\\u7801|\\u624b\\u673a\\u53f7|\\u5bc6\\u7801\\u767b\\u5f55|\\u8bf7\\u767b\\u5f55|login|sign\\s*in/i.test(all);
    const loggedInSignals = /\\u6211\\u7684\\u7b80\\u5386|\\u6211\\u7684\\u730e\\u8058|\\u6c9f\\u901a|\\u6d88\\u606f|\\u5df2\\u6295\\u9012|\\u804c\\u4f4d\\u63a8\\u8350|\\u5bf9\\u6211\\u611f\\u5174\\u8da3|\\u5728\\u7ebf\\u7b80\\u5386|\\u6211\\u7684BOSS/i.test(all);
    const accessLimited = /\\u5b89\\u5168\\u9a8c\\u8bc1|\\u9a8c\\u8bc1\\u7801|\\u8bbf\\u95ee\\u8fc7\\u4e8e\\u9891\\u7e41|\\u6ed1\\u5757|captcha|verify|_security_check/i.test(all);
    return JSON.stringify({
      url: location.href,
      title: document.title || "",
      loginRequired,
      loggedInSignals,
      accessLimited,
      textLength: text.length
    });
  })()`;
}

async function evaluateAuthTarget(target, url) {
  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.connect();
  try {
    await session.send("Network.enable").catch(() => null);
    const cookieResult = await session.send("Network.getCookies", { urls: [url] }).catch(() => ({ cookies: [] }));
    const evalResult = await session.send("Runtime.evaluate", {
      expression: authExpression(),
      returnByValue: true,
      awaitPromise: true,
    });
    const value = evalResult?.result?.value;
    const pageState = typeof value === "string" ? JSON.parse(value) : value;
    const cookies = Array.isArray(cookieResult.cookies) ? cookieResult.cookies : [];
    const cookieNameHints = cookies
      .map((cookie) => String(cookie.name || ""))
      .filter((name) => /token|auth|sid|session|login|uid|user|passport|ticket|wt2|zp|boss|liepin/i.test(name))
      .slice(0, 12);
    return {
      ...pageState,
      cookieCount: cookies.length,
      authCookieNameHints: cookieNameHints,
    };
  } finally {
    session.close();
  }
}

function classifyAuth(pageState) {
  if (pageState.accessLimited) return "needs-user-action";
  if (pageState.loggedInSignals && !pageState.loginRequired) return "logged-in";
  if (pageState.loggedInSignals && pageState.authCookieNameHints?.length) return "logged-in";
  if (pageState.loginRequired && !pageState.authCookieNameHints?.length) return "login-required";
  if (pageState.authCookieNameHints?.length || pageState.cookieCount >= 4) return "probably-logged-in";
  return "unknown";
}

function expandSites(site) {
  const s = String(site || "both").toLowerCase();
  if (s === "both") return ["liepin", "boss"];
  return AUTH_SITES[s] ? [s] : [];
}

function siteFromUrl(url) {
  const s = String(url || "");
  if (/liepin\.com/i.test(s)) return "liepin";
  if (/zhipin\.com/i.test(s)) return "boss";
  return null;
}

function sitesFromRecords(records, fallbackSite = "both") {
  const out = new Set();
  for (const record of records) {
    if (record.site && AUTH_SITES[record.site]) out.add(record.site);
    const byUrl = siteFromUrl(record.url || record.href || "");
    if (byUrl) out.add(byUrl);
  }
  if (!out.size) {
    for (const site of expandSites(fallbackSite)) out.add(site);
  }
  return Array.from(out);
}

async function checkAuthForSite(port, site, { fresh = false } = {}) {
  const cfg = AUTH_SITES[site];
  if (!cfg) throw new Error(`Unknown auth site: ${site}`);
  let targets = (await listTargets(port)).filter((target) =>
    target.type === "page" && target.webSocketDebuggerUrl && cfg.hostRe.test(target.url || "")
  );
  let target = fresh ? null : targets[0];
  if (!target) {
    const opened = await openBackgroundTabs(port, [{ url: cfg.checkUrl }], 0);
    await delay(2500);
    targets = await listTargets(port);
    target = targets.find((candidate) => candidate.id === opened.opened[0]?.targetId)
      || targets.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl && cfg.hostRe.test(candidate.url || ""));
  }
  if (!target) {
    return {
      site,
      label: cfg.label,
      status: "unknown",
      checkUrl: cfg.checkUrl,
      reloginUrl: cfg.reloginUrl,
      reason: "No target page was available for auth inspection.",
    };
  }
  const pageState = await evaluateAuthTarget(target, cfg.checkUrl);
  const status = classifyAuth(pageState);
  return {
    site,
    label: cfg.label,
    status,
    checkUrl: cfg.checkUrl,
    reloginUrl: cfg.reloginUrl,
    page: {
      url: pageState.url,
      title: pageState.title,
      loginRequired: pageState.loginRequired,
      loggedInSignals: pageState.loggedInSignals,
      accessLimited: pageState.accessLimited,
      textLength: pageState.textLength,
    },
    cookies: {
      count: pageState.cookieCount,
      authNameHintCount: pageState.authCookieNameHints.length,
      authNameHints: pageState.authCookieNameHints,
    },
  };
}

function authOk(status) {
  return status === "logged-in" || status === "probably-logged-in";
}

async function checkAuthForSites(port, sites, options = {}) {
  const results = [];
  for (const site of sites) {
    results.push(await checkAuthForSite(port, site, options));
  }
  return results;
}

function writeAuthStatus(results) {
  ensureStateDir();
  const output = path.join(STATE_DIR, "auth_status.json");
  const redacted = results.map((result) => ({
    ...result,
    cookies: {
      count: result.cookies?.count ?? 0,
      authNameHintCount: result.cookies?.authNameHintCount ?? 0,
    },
  }));
  writeJson(output, { createdAt: new Date().toISOString(), results: redacted });
  return output;
}

async function openReloginPages(port, authResults) {
  const urls = authResults
    .filter((result) => !authOk(result.status))
    .map((result) => result.reloginUrl)
    .filter(Boolean);
  if (!urls.length) return [];
  return (await openBackgroundTabs(port, urls.map((url) => ({ url })), 500)).opened;
}

async function assertAuthReady(port, sites, { openLogin = true, fresh = true } = {}) {
  const results = await checkAuthForSites(port, sites, { fresh });
  const output = writeAuthStatus(results);
  const bad = results.filter((result) => !authOk(result.status));
  if (bad.length) {
    const opened = openLogin ? await openReloginPages(port, bad) : [];
    const summary = bad.map((result) => `${result.site}:${result.status}`).join(", ");
    throw new Error(
      `Login check failed (${summary}). Re-login or finish site verification in the opened browser tab, then rerun. Auth status: ${output}. Relogin pages opened: ${opened.length}`,
    );
  }
  return { results, output };
}

function loadOpenedState() {
  ensureStateDir();
  const ids = new Set();
  const urls = new Set();
  for (const name of ["opened_ids.txt", "opened_urls.txt"]) {
    const file = path.join(STATE_DIR, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      if (name.includes("ids")) ids.add(s);
      else urls.add(s);
    }
  }
  return { ids, urls };
}

function appendOpenedState(records) {
  ensureStateDir();
  const idLines = [];
  const urlLines = [];
  for (const record of records) {
    const canonical = canonicalJobUrl(record.url || "");
    if (canonical) idLines.push(`${canonical.site}:${canonical.id}`);
    if (record.url) urlLines.push(record.url);
  }
  if (idLines.length) fs.appendFileSync(path.join(STATE_DIR, "opened_ids.txt"), `${idLines.join("\n")}\n`, "utf8");
  if (urlLines.length) fs.appendFileSync(path.join(STATE_DIR, "opened_urls.txt"), `${urlLines.join("\n")}\n`, "utf8");
}

function alreadyOpened(record, opened) {
  const canonical = canonicalJobUrl(record.url || "");
  if (canonical && opened.ids.has(`${canonical.site}:${canonical.id}`)) return true;
  return opened.urls.has(record.url);
}

function readMaybeText(file) {
  if (!file) return "";
  const resolved = path.resolve(ROOT, file);
  if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`);
  if (/\.docx$/i.test(resolved)) return extractDocxText(resolved);
  return fs.readFileSync(resolved, "utf8");
}

function readZipEntries(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`Not a zip/docx file: ${file}`);
  const total = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  let ptr = cdOffset;
  for (let i = 0; i < total; i += 1) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.slice(ptr + 46, ptr + 46 + nameLen).toString("utf8");
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buf.slice(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = zlib.inflateRawSync(compressed);
    else data = null;
    if (data) entries.set(name, data);
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decodeXmlEntities(text) {
  return String(text)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractDocxText(file) {
  const entries = readZipEntries(file);
  const names = Array.from(entries.keys()).filter((name) =>
    /^word\/(?:document|header\d+|footer\d+)\.xml$/i.test(name),
  );
  const parts = [];
  for (const name of names) {
    let xml = entries.get(name).toString("utf8");
    xml = xml
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "");
    parts.push(decodeXmlEntities(xml));
  }
  return normalizeText(parts.join("\n"));
}

function extractNeedTerms(text) {
  const terms = new Set();
  for (const m of String(text || "").matchAll(/[A-Za-z][A-Za-z0-9+#./-]{1,}/g)) {
    const term = m[0].trim();
    if (term.length >= 2) terms.add(term);
  }
  for (const phrase of DEFAULT_POSITIVE_TERMS.map(([term]) => term)) {
    if (includesTerm(text, phrase)) terms.add(phrase);
  }
  return Array.from(terms);
}

function firstUsefulLine(record) {
  const text = normalizeText(record.title || record.jobTitle || record.position || record.titleText || record.cardText || "");
  const line = text.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return line || "";
}

function scoreRecord(record, context) {
  const title = firstUsefulLine(record);
  const text = normalizeText(
    [
      record.title,
      record.jobTitle,
      record.position,
      record.company,
      record.city,
      record.salary,
      record.experience,
      record.education,
      record.titleText,
      record.cardText,
      record.matchPoint,
      record.description,
      record.intro,
      record.verified_intro,
      record.verified_props,
      record.sourceTitle,
    ].filter(Boolean).join("\n"),
  );
  let score = 0;
  const reasons = [];
  const penalties = [];

  const positiveTerms = [...DEFAULT_POSITIVE_TERMS];
  for (const term of context.needTerms) positiveTerms.push([term, 7]);
  for (const term of context.resumeTerms) positiveTerms.push([term, 4]);
  for (const term of context.includeTerms) positiveTerms.push([term, 12]);

  const seen = new Set();
  for (const [term, weight] of positiveTerms) {
    const key = String(term).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (includesTerm(title, term)) {
      score += weight * 2;
      reasons.push(`${term}:title`);
    } else if (includesTerm(text, term)) {
      score += weight;
      reasons.push(term);
    }
  }

  for (const term of context.excludeTerms) {
    if (includesTerm(text, term)) {
      score -= 100;
      penalties.push(`${term}:hard-exclude`);
    }
  }

  for (const [term, penalty] of DEFAULT_NEGATIVE_TERMS) {
    if (includesTerm(title, term)) {
      score -= penalty * 2;
      penalties.push(`${term}:title`);
    } else if (includesTerm(text, term)) {
      score -= penalty;
      penalties.push(term);
    }
  }

  if (!title) {
    score -= 15;
    penalties.push("missing-title");
  }
  return { score, title, reasons: reasons.slice(0, 12), penalties: penalties.slice(0, 8) };
}

function loadRecords(inputFile) {
  const text = fs.readFileSync(path.resolve(ROOT, inputFile), "utf8");
  if (/\.json$/i.test(inputFile)) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.selected)) return data.selected;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    throw new Error("JSON input must contain an array, items, selected, or results");
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((url) => {
      const canonical = canonicalJobUrl(url);
      return { ...(canonical || {}), url };
    });
}

function writeJson(file, value) {
  ensureStateDir();
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeRankArtifacts(outputFile, selected, ranked, rejected, meta) {
  writeJson(outputFile, { meta, selected, rejected });
  const urlsFile = outputFile.replace(/\.json$/i, ".urls.txt");
  fs.writeFileSync(urlsFile, `${selected.map((item) => item.url).join("\n")}\n`, "utf8");
  const reportFile = outputFile.replace(/\.json$/i, ".md");
  const lines = [
    "# Job Board Selection",
    "",
    `Created: ${meta.createdAt}`,
    `Need: ${meta.need || ""}`,
    `Selected: ${selected.length}`,
    `Rejected or skipped: ${rejected.length}`,
    "",
    "## Selected",
    "",
  ];
  selected.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title || firstUsefulLine(item)} | score=${item.score} | ${item.site || ""}`);
    lines.push(`   ${item.url}`);
    if (item.reasons?.length) lines.push(`   match: ${item.reasons.join(", ")}`);
    if (item.penalties?.length) lines.push(`   penalty: ${item.penalties.join(", ")}`);
  });
  lines.push("", "## Typical Skips", "");
  rejected.slice(0, 50).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title || firstUsefulLine(item)} | score=${item.score} | ${item.skipReason || ""}`);
    if (item.url) lines.push(`   ${item.url}`);
  });
  fs.writeFileSync(reportFile, `${lines.join("\n")}\n`, "utf8");
  return { outputFile, urlsFile, reportFile };
}

async function cmdDiagnose(args) {
  const hit = await ensureCdp(args, { start: boolOption(args, "start") });
  if (!hit) {
    console.log(
      JSON.stringify(
        {
          cdp_available: false,
          probed_ports: intOption(args, "port", null) ? [intOption(args, "port", null)] : DEFAULT_PORTS,
          diagnosis:
            "CDP is not available. Start Edge Beta with --remote-debugging-port and a non-default user-data-dir, then log in manually.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }
  const targets = await listTargets(hit.port).catch(() => []);
  console.log(
    JSON.stringify(
      {
        cdp_available: true,
        cdp_port: hit.port,
        browser: hit.version.Browser,
        page_targets: targets.filter((t) => t.type === "page").length,
        job_board_targets: targets
          .filter((t) => t.type === "page" && /liepin\.com|zhipin\.com/i.test(t.url || ""))
          .map((t) => ({ title: t.title, url: t.url })),
      },
      null,
      2,
    ),
  );
}

function cmdLaunchHint(args) {
  const port = intOption(args, "port", 9222);
  console.log("Start a dedicated Edge Beta CDP profile, then log in to BOSS/Zhipin and Liepin manually:");
  console.log(
    `"${EDGE_BETA_EXE}" --remote-debugging-port=${port} --remote-allow-origins=http://127.0.0.1:${port} --user-data-dir="${EDGE_CDP_PROFILE}"`,
  );
  console.log("Keep the CDP port on localhost. Do not save credentials in this workspace.");
}

async function cmdStartBrowser(args) {
  const port = intOption(args, "port", 9222);
  const hit = await ensureCdp(args, { start: true });
  console.log(JSON.stringify({
    cdp_available: Boolean(hit),
    cdp_port: hit?.port || port,
    browser: hit?.version?.Browser || null,
    profile: EDGE_CDP_PROFILE_PATH,
    note: "Login cookies stay inside this Edge profile. They are not exported to the workspace.",
  }, null, 2));
}

async function cmdAuth(args) {
  const hit = await ensureCdp(args, { start: boolOption(args, "start") });
  if (!hit) throw new Error("CDP is not available. Run start-browser or launch-hint first.");
  const site = option(args, "site", "both");
  const results = await checkAuthForSites(hit.port, expandSites(site), {
    fresh: !boolOption(args, "reuse-page"),
  });
  const output = writeAuthStatus(results);
  const bad = results.filter((result) => !authOk(result.status));
  let reloginPagesOpened = [];
  if (bad.length && boolOption(args, "open-login")) {
    reloginPagesOpened = await openReloginPages(hit.port, bad);
  }
  const response = {
    cdp_port: hit.port,
    profile: EDGE_CDP_PROFILE_PATH,
    output,
    all_ready: bad.length === 0,
    relogin_pages_opened: reloginPagesOpened.length,
    results: results.map((result) => ({
      site: result.site,
      status: result.status,
      page: result.page,
      cookies: boolOption(args, "verbose")
        ? result.cookies
        : {
            count: result.cookies.count,
            authNameHintCount: result.cookies.authNameHintCount,
          },
      reloginUrl: result.reloginUrl,
    })),
  };
  console.log(JSON.stringify(response, null, 2));
  if (bad.length) process.exitCode = 3;
}

async function cmdCollect(args) {
  ensureStateDir();
  const site = String(option(args, "site", "both")).toLowerCase();
  const hit = await ensureCdp(args, { start: boolOption(args, "start") });
  if (!hit) throw new Error("CDP is not available. Run start-browser or launch-hint and log in first.");
  const seedUrls = values(args, "url").map((url) => String(url).trim()).filter(Boolean);
  if (!boolOption(args, "skip-auth-check")) {
    const authSites = seedUrls.map(siteFromUrl).filter(Boolean);
    const sites = authSites.length ? Array.from(new Set(authSites)) : expandSites(site);
    await assertAuthReady(hit.port, sites, {
      openLogin: !boolOption(args, "no-open-login"),
      fresh: !boolOption(args, "reuse-auth-page"),
    });
  }
  const seedHosts = seedUrls.map((url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }).filter(Boolean);
  let seeded = [];
  if (seedUrls.length) {
    const delayMs = Math.max(0, Number(option(args, "delay-ms", "1200")) || 0);
    seeded = (await openBackgroundTabs(
      hit.port,
      seedUrls.map((url) => ({ url })),
      delayMs,
    )).opened;
    await new Promise((resolve) => setTimeout(resolve, 1800));
  }
  const targets = (await listTargets(hit.port)).filter((target) => {
    if (target.type !== "page" || !target.webSocketDebuggerUrl) return false;
    if (boolOption(args, "all-tabs")) return true;
    if (seedUrls.length && (seedUrls.some((url) => target.url === url || target.url.startsWith(url)) || seedHosts.some((host) => includesTerm(target.url, host)))) {
      return true;
    }
    return siteMatches(target.url, site);
  });
  const contains = splitTerms(values(args, "target-url-contains"));
  const filteredTargets = contains.length
    ? targets.filter((target) => contains.some((term) => includesTerm(target.url, term)))
    : targets;

  const expression = extractionExpression(site);
  const pages = [];
  const itemsByKey = new Map();
  const warnings = [];
  for (const target of filteredTargets) {
    try {
      const data = await evaluateTarget(target, expression);
      pages.push({ title: data.title, url: data.url, count: data.items?.length || 0, accessLimited: data.accessLimited });
      if (data.accessLimited) warnings.push(`Access limitation detected on ${data.url}`);
      for (const item of data.items || []) {
        const key = recordKey(item);
        if (!key || itemsByKey.has(key)) continue;
        itemsByKey.set(key, item);
      }
    } catch (error) {
      warnings.push(`Failed to evaluate ${target.url}: ${error.message}`);
    }
  }
  const items = Array.from(itemsByKey.values());
  const output = path.resolve(ROOT, option(args, "out", path.join(STATE_DIR, `candidates_${timestamp()}.json`)));
  const payload = {
    meta: { createdAt: new Date().toISOString(), cdpPort: hit.port, site, seeded, pages, warnings },
    items,
  };
  writeJson(output, payload);
  console.log(JSON.stringify({ output, item_count: items.length, page_count: pages.length, warnings }, null, 2));
}

function cmdResume(args) {
  ensureStateDir();
  const file = option(args, "file", "求职简历.docx");
  const text = readMaybeText(file);
  const output = path.resolve(ROOT, option(args, "out", path.join(STATE_DIR, `resume_text_${timestamp()}.txt`)));
  fs.writeFileSync(output, `${text}\n`, "utf8");
  console.log(JSON.stringify({ output, chars: text.length, preview: text.slice(0, 600) }, null, 2));
}

function cmdRank(args) {
  ensureStateDir();
  const input = option(args, "input", null);
  if (!input) throw new Error("rank requires --input <candidates.json>");
  const max = intOption(args, "max", DEFAULT_MAX_BATCH);
  const minScore = intOption(args, "min-score", 8);
  const need = String(option(args, "need", ""));
  const resumeText = readMaybeText(option(args, "resume", "求职简历.docx"));
  const includeTerms = splitTerms(values(args, "include"));
  const excludeTerms = splitTerms(values(args, "exclude"));
  const opened = loadOpenedState();
  const records = loadRecords(input);
  const resumeTerms = DEFAULT_POSITIVE_TERMS.map(([term]) => term).filter((term) => includesTerm(resumeText, term));
  const context = {
    need,
    needTerms: extractNeedTerms(need),
    resumeTerms,
    includeTerms,
    excludeTerms,
  };

  const ranked = [];
  const rejected = [];
  const seen = new Set();
  for (const raw of records) {
    const canonical = canonicalJobUrl(raw.url || "");
    const record = { ...raw, ...(canonical || {}) };
    const key = recordKey(record);
    if (!record.url || seen.has(key)) continue;
    seen.add(key);
    const scored = { ...record, ...scoreRecord(record, context) };
    if (alreadyOpened(scored, opened)) {
      rejected.push({ ...scored, skipReason: "already-opened" });
      continue;
    }
    if (scored.score < minScore) {
      rejected.push({ ...scored, skipReason: "below-min-score" });
      continue;
    }
    ranked.push(scored);
  }
  ranked.sort((a, b) => b.score - a.score);
  const selected = ranked.slice(0, max);
  const output = path.resolve(ROOT, option(args, "out", path.join(STATE_DIR, `selection_${timestamp()}.json`)));
  const artifacts = writeRankArtifacts(output, selected, ranked, rejected, {
    createdAt: new Date().toISOString(),
    input: path.resolve(ROOT, input),
    need,
    max,
    minScore,
    resume: path.resolve(ROOT, option(args, "resume", "求职简历.docx")),
    includeTerms,
    excludeTerms,
    selectedCount: selected.length,
    rankedCount: ranked.length,
    rejectedCount: rejected.length,
  });
  console.log(JSON.stringify({ ...artifacts, selected_count: selected.length, ranked_count: ranked.length, rejected_count: rejected.length }, null, 2));
}

async function openBackgroundTabs(port, records, delayMs) {
  const version = await fetchJson(`http://127.0.0.1:${port}/json/version`, 2500);
  const session = new CdpSession(version.webSocketDebuggerUrl);
  await session.connect();
  const opened = [];
  try {
    for (const record of records) {
      const result = await session.send("Target.createTarget", {
        url: record.url,
        background: true,
      });
      opened.push({ ...record, targetId: result.targetId });
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  } finally {
    session.close();
  }
  return { browser: version.Browser, opened };
}

async function cmdOpen(args) {
  ensureStateDir();
  const input = option(args, "input", null);
  const urlArgs = values(args, "url");
  let records = [];
  if (input) records = loadRecords(input);
  records.push(...urlArgs.map((url) => ({ ...(canonicalJobUrl(url) || {}), url })));
  records = records.map((record) => ({ ...record, ...(canonicalJobUrl(record.url || "") || {}) })).filter((record) => record.url);
  const seen = new Set();
  records = records.filter((record) => {
    const key = recordKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!boolOption(args, "allow-previous")) {
    const opened = loadOpenedState();
    records = records.filter((record) => !alreadyOpened(record, opened));
  }
  const maxBatch = intOption(args, "max-per-batch", DEFAULT_MAX_BATCH);
  if (records.length > maxBatch && !boolOption(args, "confirm-large")) {
    throw new Error(
      `Refusing to open ${records.length} tabs because max-per-batch is ${maxBatch}. Split the batch or pass --confirm-large intentionally.`,
    );
  }
  if (boolOption(args, "dry-run")) {
    console.log(JSON.stringify({ dry_run: true, would_open_count: records.length, records }, null, 2));
    return;
  }
  const hit = await ensureCdp(args, { start: boolOption(args, "start") });
  if (!hit) throw new Error("CDP is not available. Run start-browser or launch-hint and log in first.");
  if (!boolOption(args, "skip-auth-check")) {
    await assertAuthReady(hit.port, sitesFromRecords(records, option(args, "site", "both")), {
      openLogin: !boolOption(args, "no-open-login"),
      fresh: !boolOption(args, "reuse-auth-page"),
    });
  }
  const delayMs = Math.max(0, Number(option(args, "delay-ms", "800")) || 0);
  const result = await openBackgroundTabs(hit.port, records, delayMs);
  appendOpenedState(result.opened);
  const output = path.resolve(ROOT, option(args, "out", path.join(STATE_DIR, `opened_${timestamp()}.json`)));
  writeJson(output, {
    meta: { createdAt: new Date().toISOString(), cdpPort: hit.port, browser: result.browser, delayMs },
    opened: result.opened,
  });
  console.log(JSON.stringify({ output, opened_count: result.opened.length, cdp_port: hit.port, browser: result.browser }, null, 2));
}

function cmdOpened() {
  const state = loadOpenedState();
  console.log(
    JSON.stringify(
      {
        state_dir: STATE_DIR,
        opened_id_count: state.ids.size,
        opened_url_count: state.urls.size,
      },
      null,
      2,
    ),
  );
}

function cmdWorkflow() {
  console.log(`Job-board AI workflow

1. Start Edge Beta CDP:
   .\\tools\\job-board.cmd start-browser
   This reuses the durable Edge Beta CodexCdpProfile. Login cookies stay in that browser profile.

2. Verify browser and site login state:
   .\\tools\\job-board.cmd diagnose
   .\\tools\\job-board.cmd auth --site both --open-login

3. Open or navigate search result pages in that Edge Beta profile. Do not save credentials in this workspace.
   Optional: pass search result URLs to collect with --url so they are opened as background tabs through CDP.

4. Collect job detail links from the logged-in pages:
   .\\tools\\job-board.cmd collect --site both
   .\\tools\\job-board.cmd collect --site liepin --url "https://www.liepin.com/zhaopin/?key=K8S"

5. Rank candidates against resume and current user need:
   .\\tools\\job-board.cmd rank --input .tmp\\job_board_harness\\candidates_YYYYMMDD_HHMMSS.json --need "AI Agent / 嵌入式 / DevOps"

6. Let the AI review the generated .md/.json selection. Edit or regenerate if the list contains false positives.

7. Open selected job detail pages as independent background tabs in the same Edge Beta CDP browser, not new windows:
   .\\tools\\job-board.cmd open --input .tmp\\job_board_harness\\selection_YYYYMMDD_HHMMSS.json --max-per-batch 15
`);
}

function cmdHelp() {
  console.log(`Usage: job-board <command> [options]

Commands:
  launch-hint             Print the Edge Beta CDP launch command
  start-browser           Start or reuse the durable Edge Beta CDP profile
  diagnose                Probe CDP and list current job-board targets
  auth                    Check BOSS/Liepin login state without exporting cookies
  resume --file <docx>    Extract resume text from DOCX/TXT/MD
  collect                 Collect BOSS/Liepin job detail links from logged-in tabs
  rank --input <json>     Rank collected links against resume and user need
  open --input <json>     Open selected detail URLs as background tabs via CDP
  opened                  Show local dedup state counts
  workflow                Print the recommended AI workflow

Common options:
  --port 9222
  --site both|liepin|boss
  --start                 Start Edge Beta CDP profile if CDP is unavailable
  --open-login            For auth: open login/check pages when auth is not ready
  --skip-auth-check       For collect/open: bypass login-state gate intentionally
  --url search-url        For collect: open a search/list URL as a background tab first
  --all-tabs
  --need "..."
  --resume 求职简历.docx
  --include term          Repeatable or comma-separated
  --exclude term          Repeatable or comma-separated
  --max 15
  --max-per-batch 15
  --dry-run
`);
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (command) {
    case "launch-hint":
      cmdLaunchHint(args);
      break;
    case "start-browser":
      await cmdStartBrowser(args);
      break;
    case "diagnose":
      await cmdDiagnose(args);
      break;
    case "auth":
      await cmdAuth(args);
      break;
    case "resume":
      cmdResume(args);
      break;
    case "collect":
      await cmdCollect(args);
      break;
    case "rank":
      cmdRank(args);
      break;
    case "open":
      await cmdOpen(args);
      break;
    case "opened":
      cmdOpened(args);
      break;
    case "workflow":
      cmdWorkflow(args);
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
