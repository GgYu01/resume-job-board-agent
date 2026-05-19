export const FOLLOWUP_RECHECK_SCHEMA = "job-board-followup-recheck/v1";
export const DEFAULT_FOLLOWUP_RECHECK_RETRY_AFTER_HOURS = 12;

function isoNow(value = null) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function addHours(iso, hours) {
  const date = new Date(iso);
  date.setTime(date.getTime() + Math.max(1, Number(hours) || DEFAULT_FOLLOWUP_RECHECK_RETRY_AFTER_HOURS) * 60 * 60 * 1000);
  return date.toISOString();
}

function unique(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function queueKey(record = {}) {
  const site = compact(record.site).toLowerCase() || "unknown";
  const id = compact(record.canonical_id || record.canonicalId || record.id || record.url || "unknown");
  return `${site}:${id}`;
}

function expectedConversation(record = {}) {
  const verificationExpected = record.verification?.expectedConversation || {};
  const triggerExpected = record.expectedConversation || {};
  return {
    jobTitle: compact(verificationExpected.jobTitle || triggerExpected.jobTitle || record.jobTitle || record.position || record.title),
    recruiter: compact(verificationExpected.recruiter || triggerExpected.recruiter || record.recruiter || record.bossName || record.contactName),
    company: compact(verificationExpected.company || triggerExpected.company || record.company || record.companyName),
  };
}

function sanitizeMessagePlan(messagePlan = null) {
  if (!messagePlan || typeof messagePlan !== "object") return null;
  return {
    normalizedCount: Number(messagePlan.normalizedCount || 0),
    totalChars: Number(messagePlan.totalChars || 0),
    messages: Array.isArray(messagePlan.messages)
      ? messagePlan.messages.map((message) => ({
          index: Number(message.index || 0),
          role: String(message.role || ""),
          length: Number(message.length || 0),
          sha256: String(message.sha256 || ""),
        }))
      : [],
    sources: messagePlan.sources && typeof messagePlan.sources === "object"
      ? Object.fromEntries(Object.entries(messagePlan.sources).map(([key, value]) => [key, typeof value === "number" ? value : String(value || "")]))
      : {},
  };
}

function normalizeQueue(queue = null, now = isoNow()) {
  return {
    schema: FOLLOWUP_RECHECK_SCHEMA,
    createdAt: queue?.createdAt || now,
    updatedAt: queue?.updatedAt || now,
    items: Array.isArray(queue?.items) ? queue.items.map((item) => ({ ...item })) : [],
    history: Array.isArray(queue?.history) ? queue.history.slice() : [],
  };
}

function unavailableActions(followup = {}) {
  return (followup.actions || []).filter((action) =>
    action?.unavailable ||
    action?.status === "platform-unavailable" ||
    action?.reason === "platform-requires-mutual-reply"
  );
}

function evidenceFromActions(actions = []) {
  const out = {};
  for (const action of actions) {
    const type = compact(action.type);
    if (!type) continue;
    out[type] = compact(action.targetText || action.text || action.reason || action.status);
  }
  return out;
}

export function extractFollowupRecheckEntries(contactActions = [], {
  receiptPath = "",
  now = isoNow(),
} = {}) {
  const createdAt = isoNow(now);
  const entries = [];
  for (const action of contactActions || []) {
    const followup = action?.followup || {};
    if (!followup.enabled || !followup.attempted) continue;
    const blocked = unavailableActions(followup);
    if (!blocked.length) continue;
    const conversation = expectedConversation(action);
    const pendingActions = unique(blocked.map((item) => item.type));
    entries.push({
      key: queueKey(action),
      site: compact(action.site).toLowerCase(),
      id: compact(action.id),
      canonical_id: compact(action.canonical_id || action.canonicalId || action.id),
      url: compact(action.url),
      title: conversation.jobTitle || compact(action.title),
      company: conversation.company,
      recruiter: conversation.recruiter,
      pendingActions,
      status: "pending",
      reason: "platform-requires-mutual-reply",
      createdAt,
      updatedAt: createdAt,
      lastUnavailableAt: createdAt,
      nextCheckAt: createdAt,
      attemptCount: 0,
      lastReceipt: compact(receiptPath),
      lastEvidence: evidenceFromActions(blocked),
      messagePlan: sanitizeMessagePlan(followup.messagePlan),
    });
  }
  return entries;
}

export function upsertFollowupRecheckQueue(queue, entries = [], {
  now = isoNow(),
  retryAfterHours = DEFAULT_FOLLOWUP_RECHECK_RETRY_AFTER_HOURS,
} = {}) {
  const updatedAt = isoNow(now);
  const nextCheckAt = addHours(updatedAt, retryAfterHours);
  const next = normalizeQueue(queue, updatedAt);
  const byKey = new Map(next.items.map((item) => [item.key, item]));
  for (const entry of entries || []) {
    const key = entry.key || queueKey(entry);
    const existing = byKey.get(key);
    const merged = {
      ...(existing || {}),
      ...entry,
      key,
      pendingActions: unique([...(existing?.pendingActions || []), ...(entry.pendingActions || [])]),
      status: "pending",
      reason: entry.reason || existing?.reason || "platform-requires-mutual-reply",
      createdAt: existing?.createdAt || entry.createdAt || updatedAt,
      updatedAt,
      lastUnavailableAt: updatedAt,
      nextCheckAt,
      attemptCount: Number(existing?.attemptCount || 0),
      lastReceipt: entry.lastReceipt || existing?.lastReceipt || "",
      lastEvidence: { ...(existing?.lastEvidence || {}), ...(entry.lastEvidence || {}) },
      messagePlan: entry.messagePlan || existing?.messagePlan || null,
    };
    byKey.set(key, merged);
  }
  next.items = [...byKey.values()];
  next.updatedAt = updatedAt;
  return next;
}

export function selectDueFollowupRechecks(queue, {
  now = isoNow(),
  max = 10,
  includeNotDue = false,
} = {}) {
  const current = new Date(now).getTime();
  return (queue?.items || [])
    .filter((item) => item.status === "pending")
    .filter((item) => includeNotDue || !item.nextCheckAt || new Date(item.nextCheckAt).getTime() <= current)
    .sort((a, b) => new Date(a.nextCheckAt || a.updatedAt || 0).getTime() - new Date(b.nextCheckAt || b.updatedAt || 0).getTime())
    .slice(0, Math.max(1, Number(max) || 10));
}

function completedActionTypes(followup = {}) {
  return unique((followup.actions || [])
    .filter((action) => action?.satisfied || action?.alreadySatisfied || action?.clicked)
    .map((action) => action.type));
}

function actionKey(action = {}) {
  return queueKey(action);
}

export function applyFollowupRecheckResults(queue, contactActions = [], {
  now = isoNow(),
  retryAfterHours = DEFAULT_FOLLOWUP_RECHECK_RETRY_AFTER_HOURS,
} = {}) {
  const updatedAt = isoNow(now);
  const next = normalizeQueue(queue, updatedAt);
  const byKey = new Map(next.items.map((item) => [item.key, { ...item }]));
  for (const action of contactActions || []) {
    const key = actionKey(action);
    const existing = byKey.get(key);
    if (!existing) continue;
    const followup = action.followup || {};
    const attemptCount = Number(existing.attemptCount || 0) + 1;
    const base = {
      ...existing,
      updatedAt,
      lastCheckedAt: updatedAt,
      attemptCount,
      lastReceipt: action.receiptPath || existing.lastReceipt || "",
    };

    if (followup.status === "followup-skipped-rejected" || followup.skipReason === "conversation-rejected") {
      byKey.set(key, {
        ...base,
        status: "rejected",
        terminalReason: "conversation-rejected",
        nextCheckAt: null,
      });
      continue;
    }

    const blocked = unavailableActions(followup);
    if (blocked.length) {
      byKey.set(key, {
        ...base,
        status: "pending",
        reason: "platform-requires-mutual-reply",
        pendingActions: unique(blocked.map((item) => item.type)),
        lastUnavailableAt: updatedAt,
        nextCheckAt: addHours(updatedAt, retryAfterHours),
        lastEvidence: evidenceFromActions(blocked),
      });
      continue;
    }

    const completedActions = completedActionTypes(followup);
    const requiredActions = existing.pendingActions || [];
    const allRequiredComplete = requiredActions.every((type) => completedActions.includes(type));
    if (followup.verified && allRequiredComplete) {
      byKey.set(key, {
        ...base,
        status: "completed",
        completedAt: updatedAt,
        completedActions: unique([...completedActions, ...requiredActions]),
        pendingActions: [],
        nextCheckAt: null,
      });
      continue;
    }

    byKey.set(key, {
      ...base,
      status: "pending",
      lastError: action.error || followup.error || followup.status || "followup-recheck-not-verified",
      nextCheckAt: addHours(updatedAt, retryAfterHours),
    });
  }
  next.items = [...byKey.values()];
  next.updatedAt = updatedAt;
  return next;
}

export function summarizeFollowupRecheckQueue(queue, {
  now = isoNow(),
} = {}) {
  const items = queue?.items || [];
  return {
    total: items.length,
    pending: items.filter((item) => item.status === "pending").length,
    due: selectDueFollowupRechecks(queue, { now, max: items.length || 1 }).length,
    completed: items.filter((item) => item.status === "completed").length,
    rejected: items.filter((item) => item.status === "rejected").length,
    failed: items.filter((item) => item.status === "failed").length,
  };
}

export function recordFollowupRecheckQueueFromContactActions(queue, contactActions = [], {
  receiptPath = "",
  now = isoNow(),
  retryAfterHours = DEFAULT_FOLLOWUP_RECHECK_RETRY_AFTER_HOURS,
} = {}) {
  const entries = extractFollowupRecheckEntries(contactActions, { receiptPath, now });
  const nextQueue = upsertFollowupRecheckQueue(queue, entries, { now, retryAfterHours });
  return {
    queue: nextQueue,
    entries,
    summary: summarizeFollowupRecheckQueue(nextQueue, { now }),
  };
}
