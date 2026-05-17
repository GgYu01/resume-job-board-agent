import fs from "node:fs";
import path from "node:path";

import { canonicalJobUrl, recordKey } from "../sites/index.mjs";

const OPENED_IDS = "opened_ids.txt";
const OPENED_URLS = "opened_urls.txt";
const OPENED_KEYS = "opened_keys.txt";

function emptyState() {
  return { ids: new Set(), urls: new Set(), keys: new Set() };
}

function normalizeIdentityText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function firstText(record, fields) {
  for (const field of fields) {
    const value = normalizeIdentityText(record?.[field]);
    if (value) return value;
  }
  return "";
}

function inferCompanyFromCardText(record, title) {
  const lines = String(record?.cardText || record?.detailText || "")
    .split(/\r?\n/)
    .map((line) => normalizeIdentityText(line))
    .filter(Boolean);
  if (!lines.length) return "";
  const titleNorm = normalizeIdentityText(title);
  const locationRe = /^(北京|上海|深圳|广州|杭州|南京|苏州|成都|武汉|西安|合肥|重庆|天津|厦门|长沙|郑州|青岛|宁波|佛山|东莞|无锡|常州)(市)?([a-z0-9\u4e00-\u9fff]{0,8})?$/iu;
  for (const line of lines) {
    if (line === titleNorm) continue;
    if (/^\d+(\s+\d+)?k/i.test(line) || /薪资|面议|元|月|年薪/i.test(line)) continue;
    if (/年|经验|学历|本科|大专|硕士|博士|不限/i.test(line)) continue;
    if (locationRe.test(line)) continue;
    if (line.length >= 2) return line;
  }
  return "";
}

function appendLineSets(file, values) {
  const lines = Array.from(new Set(values)).filter(Boolean);
  if (!lines.length) return;
  fs.appendFileSync(file, `${lines.join("\n")}\n`, "utf8");
}

function addCanonicalKeys(keys, canonical) {
  if (!canonical) return;
  keys.add(`${canonical.site}:${canonical.id}`);
  keys.add(`id:${canonical.site}:${canonical.id}`);
  keys.add(`url:${canonical.url}`);
}

function addRecordKeysToState(state, record) {
  for (const key of recordIdentityKeys(record)) {
    state.keys.add(key);
    if (key.startsWith("id:")) state.ids.add(key.slice(3));
    if (key.startsWith("url:")) state.urls.add(key.slice(4));
  }
}

function openedRecordsFromArtifact(data) {
  const records = [];
  if (Array.isArray(data?.opened)) records.push(...data.opened);
  if (Array.isArray(data?.receipts)) {
    for (const receipt of data.receipts) {
      if (Array.isArray(receipt?.opened)) records.push(...receipt.opened);
    }
  }
  if (Array.isArray(data?.queue?.receipts)) {
    for (const receipt of data.queue.receipts) {
      if (Array.isArray(receipt?.opened)) records.push(...receipt.opened);
    }
  }
  return records;
}

function backfillFromOpenedArtifacts(stateDir, state) {
  let names = [];
  try {
    names = fs.readdirSync(stateDir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!/^opened(?:_batches)?[\w.-]*\.json$/i.test(name)) continue;
    const file = path.join(stateDir, name);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    for (const record of openedRecordsFromArtifact(data)) addRecordKeysToState(state, record);
  }
}

function backfillFromOpenLedger(stateDir, state) {
  const candidates = [
    path.join(stateDir, "state", "open_ledger.jsonl"),
    path.join(stateDir, "open_ledger.jsonl"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        for (const key of event.identity_keys || []) {
          state.keys.add(key);
          if (key.startsWith("id:")) state.ids.add(key.slice(3));
          if (key.startsWith("url:")) state.urls.add(key.slice(4));
        }
        if (event.record) addRecordKeysToState(state, event.record);
      } catch {
        continue;
      }
    }
  }
}

export function recordIdentityKeys(record = {}) {
  const keys = new Set();
  const rawUrl = String(record.url || record.href || "").trim();
  const canonical = canonicalJobUrl(rawUrl);
  addCanonicalKeys(keys, canonical);
  if (rawUrl) {
    keys.add(`url:${rawUrl}`);
    const key = recordKey(record);
    if (key) keys.add(key);
  }

  const title = firstText(record, ["title", "titleText", "position", "jobTitle", "name"]);
  const company = firstText(record, ["company", "companyName", "employer"]) || inferCompanyFromCardText(record, title);
  const location = firstText(record, ["location", "city", "area", "district"]);
  if (title && company) {
    const parts = [title, company];
    keys.add(`sig:${parts.join("|")}`);
    if (location) parts.push(location);
    keys.add(`sig:${parts.join("|")}`);
  }

  return Array.from(keys);
}

export function loadOpenedState(stateDir) {
  const state = emptyState();
  fs.mkdirSync(stateDir, { recursive: true });

  const idsFile = path.join(stateDir, OPENED_IDS);
  if (fs.existsSync(idsFile)) {
    for (const line of fs.readFileSync(idsFile, "utf8").split(/\r?\n/)) {
      const value = line.trim();
      if (!value) continue;
      state.ids.add(value);
      state.keys.add(value);
      state.keys.add(`id:${value}`);
    }
  }

  const urlsFile = path.join(stateDir, OPENED_URLS);
  if (fs.existsSync(urlsFile)) {
    for (const line of fs.readFileSync(urlsFile, "utf8").split(/\r?\n/)) {
      const value = line.trim();
      if (!value) continue;
      state.urls.add(value);
      state.keys.add(`url:${value}`);
      const canonical = canonicalJobUrl(value);
      if (canonical) {
        state.ids.add(`${canonical.site}:${canonical.id}`);
        addCanonicalKeys(state.keys, canonical);
      }
    }
  }

  const keysFile = path.join(stateDir, OPENED_KEYS);
  if (fs.existsSync(keysFile)) {
    for (const line of fs.readFileSync(keysFile, "utf8").split(/\r?\n/)) {
      const value = line.trim();
      if (value) state.keys.add(value);
    }
  }

  backfillFromOpenedArtifacts(stateDir, state);
  backfillFromOpenLedger(stateDir, state);

  return state;
}

export function appendOpenedState(stateDir, records) {
  fs.mkdirSync(stateDir, { recursive: true });
  const idLines = [];
  const urlLines = [];
  const keyLines = [];

  for (const record of records || []) {
    const rawUrl = String(record?.url || record?.href || "").trim();
    const canonical = canonicalJobUrl(rawUrl);
    if (canonical) idLines.push(`${canonical.site}:${canonical.id}`);
    if (rawUrl) urlLines.push(rawUrl);
    keyLines.push(...recordIdentityKeys(record));
  }

  appendLineSets(path.join(stateDir, OPENED_IDS), idLines);
  appendLineSets(path.join(stateDir, OPENED_URLS), urlLines);
  appendLineSets(path.join(stateDir, OPENED_KEYS), keyLines);
}

export function alreadyOpened(record, openedState = emptyState()) {
  const state = openedState || emptyState();
  const rawUrl = String(record?.url || record?.href || "").trim();
  const canonical = canonicalJobUrl(rawUrl);
  if (canonical && state.ids?.has(`${canonical.site}:${canonical.id}`)) return true;
  if (rawUrl && state.urls?.has(rawUrl)) return true;
  if (canonical?.url && state.urls?.has(canonical.url)) return true;
  return recordIdentityKeys(record).some((key) => state.keys?.has(key));
}

export function dedupeOpenRecords(records, openedState = emptyState(), options = {}) {
  const allowPrevious = options.allowPrevious === true;
  const stateSkipReason = options.stateSkipReason || "already-opened";
  const kept = [];
  const rejected = [];
  const seen = new Set();

  for (const record of records || []) {
    const keys = recordIdentityKeys(record);
    if (!allowPrevious && alreadyOpened(record, openedState)) {
      rejected.push({ ...record, skipReason: stateSkipReason });
      continue;
    }

    const duplicateKey = keys.find((key) => seen.has(key));
    if (duplicateKey) {
      rejected.push({
        ...record,
        skipReason: duplicateKey.startsWith("sig:")
          ? "duplicate-job-signature"
          : "duplicate-detail-url",
      });
      continue;
    }

    kept.push(record);
    for (const key of keys) seen.add(key);
  }

  return { records: kept, rejected };
}

export function openedStateFromRecords(records) {
  const state = emptyState();
  for (const record of records || []) addRecordKeysToState(state, record);
  return state;
}

export function openedStateCounts(state) {
  const keys = state?.keys || new Set();
  return {
    opened_id_count: state?.ids?.size || 0,
    opened_url_count: state?.urls?.size || 0,
    opened_signature_count: Array.from(keys).filter((key) => key.startsWith("sig:")).length,
  };
}
