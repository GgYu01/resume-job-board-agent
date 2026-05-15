import { negativeTermsFromProfile, positiveTermsFromProfile } from "./load-config.mjs";

function uniqueTerms(items) {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    const term = String(item.term || item).trim();
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    out.push(term);
  }
  return out;
}

export function suggestProfilePatch({ feedback = {}, candidatesById = {} } = {}) {
  const operations = [];
  for (const id of feedback.false_positive || []) {
    const candidate = candidatesById[id];
    const negative = uniqueTerms(candidate?.explain?.negative || []);
    const fallback = /销售/.test(candidate?.title || candidate?.cardText || "") ? ["销售"] : [];
    for (const term of negative.length ? negative : fallback) {
      operations.push({ type: "add_negative_term", term, weight: -30, reason: `False positive: ${id}` });
    }
  }
  for (const id of feedback.false_negative || []) {
    const candidate = candidatesById[id];
    const matched = uniqueTerms(candidate?.explain?.matched || []);
    const title = String(candidate?.title || "");
    const fallback = /workflow automation/i.test(title) ? ["workflow automation"] : [];
    for (const term of matched.length ? matched : fallback) {
      operations.push({ type: "add_positive_term", term, weight: 8, reason: `False negative: ${id}` });
    }
  }
  return {
    created_by: "codex-agent",
    operations,
  };
}

export function applyProfilePatch(profile, patch) {
  const next = structuredClone(profile);
  const positive = new Set(positiveTermsFromProfile(next).map((item) => String(item.term).toLowerCase()));
  const negative = new Set(negativeTermsFromProfile(next).map((item) => String(item.term).toLowerCase()));
  if (!Array.isArray(next.should_have)) next.should_have = [];
  if (!Array.isArray(next.negative)) next.negative = [];

  for (const op of patch?.operations || []) {
    if (op.type === "add_positive_term" && op.term && !positive.has(String(op.term).toLowerCase())) {
      next.should_have.push({ term: op.term, weight: Number(op.weight ?? 8) });
      positive.add(String(op.term).toLowerCase());
    }
    if (op.type === "add_negative_term" && op.term && !negative.has(String(op.term).toLowerCase())) {
      next.negative.push({ term: op.term, weight: Number(op.weight ?? -30) });
      negative.add(String(op.term).toLowerCase());
    }
  }
  next.version = Number(next.version || 1) + 1;
  next.last_reviewed = new Date().toISOString().slice(0, 10);
  return next;
}
