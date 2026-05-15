export function parseDurationMs(value, fallbackMs) {
  if (value === undefined || value === null || value === true || value === "") return fallbackMs;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).trim().toLowerCase();
  const match = text.match(/^(\d+(?:\.\d+)?)(ms|s|m)?$/);
  if (!match) return fallbackMs;
  const n = Number(match[1]);
  const unit = match[2] || "ms";
  if (unit === "m") return Math.round(n * 60_000);
  if (unit === "s") return Math.round(n * 1000);
  return Math.round(n);
}

export function createOpenQueue(records, options = {}) {
  const now = new Date().toISOString();
  const queueId = options.queue_id || `open_${now.replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "_")}`;
  return {
    queue_id: queueId,
    status: "pending",
    reason: "",
    created_at: now,
    updated_at: now,
    max_per_batch: options.max_per_batch ?? 15,
    cooldown_ms: options.cooldown_ms ?? 45000,
    jitter_ms: options.jitter_ms ?? 10000,
    stop_on_access_limited: options.stop_on_access_limited !== false,
    cursor: 0,
    total: records.length,
    opened: 0,
    failed: 0,
    remaining: records.length,
    items: records.map((record, index) => ({
      index,
      status: "pending",
      record,
      opened_at: null,
      error: null,
    })),
    receipts: [],
  };
}

export function nextBatch(queue, maxPerBatch = queue.max_per_batch) {
  const pending = queue.items.filter((item) => item.status === "pending");
  return pending.slice(0, Math.max(1, Number(maxPerBatch) || 1));
}

export function markBatchOpened(queue, batchItems, openedRecords, receipt = {}) {
  const openedByKey = new Set((openedRecords || []).map((record) => record.index ?? record.record?.index ?? record.url));
  const openedUrls = new Set((openedRecords || []).map((record) => record.url).filter(Boolean));
  const now = new Date().toISOString();
  for (const item of batchItems) {
    if (openedByKey.has(item.index) || openedUrls.has(item.record.url)) {
      item.status = "opened";
      item.opened_at = now;
      item.error = null;
    }
  }
  queue.receipts.push({ ...receipt, created_at: now, count: openedRecords.length });
  refreshQueueSummary(queue);
  return queue;
}

export function markBatchFailed(queue, batchItems, reason) {
  const now = new Date().toISOString();
  for (const item of batchItems) {
    item.status = "failed";
    item.error = reason;
  }
  queue.status = "paused";
  queue.reason = reason;
  queue.updated_at = now;
  refreshQueueSummary(queue);
  return queue;
}

export function pauseQueue(queue, reason) {
  queue.status = "paused";
  queue.reason = reason;
  queue.updated_at = new Date().toISOString();
  refreshQueueSummary(queue);
  return queue;
}

export function refreshQueueSummary(queue) {
  queue.opened = queue.items.filter((item) => item.status === "opened").length;
  queue.failed = queue.items.filter((item) => item.status === "failed").length;
  queue.remaining = queue.items.filter((item) => item.status === "pending").length;
  const firstPending = queue.items.find((item) => item.status === "pending");
  queue.cursor = firstPending ? firstPending.index : queue.total;
  if (queue.remaining === 0 && queue.status !== "paused") queue.status = "done";
  queue.updated_at = new Date().toISOString();
  return queue;
}

export function jitterDelay(baseMs, jitterMs, random = Math.random) {
  const base = Math.max(0, Number(baseMs) || 0);
  const jitter = Math.max(0, Number(jitterMs) || 0);
  if (!jitter) return base;
  return base + Math.round(random() * jitter);
}
