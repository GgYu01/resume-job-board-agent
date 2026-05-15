import fs from "node:fs";
import path from "node:path";

export function computeRegressionMetrics({
  selected = [],
  opened = [],
  accessLimited = [],
  feedback = {},
} = {}) {
  const accepted = new Set((feedback.accepted || []).map(String));
  const falsePositive = new Set((feedback.false_positive || []).map(String));
  const openedKeys = opened.map((item) => String(item.id || item.url || "")).filter(Boolean);
  const duplicateOpenCount = openedKeys.length - new Set(openedKeys).size;
  const top15 = selected.slice(0, 15);
  const acceptedTop15 = top15.filter((item) => accepted.has(String(item.id || item.url || ""))).length;
  return {
    selected_count: selected.length,
    opened_count: opened.length,
    precision_at_15: top15.length ? acceptedTop15 / top15.length : null,
    false_positive_count: falsePositive.size,
    false_negative_count: (feedback.false_negative || []).length,
    duplicate_open_count: duplicateOpenCount,
    access_limited_count: accessLimited.length,
    user_accepted_config_suggestions_count: (feedback.accepted_config_suggestions || []).length,
  };
}

export function appendRegressionMetrics(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
  return file;
}
