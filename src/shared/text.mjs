export function normalizeText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function includesTerm(text, term) {
  if (!term) return false;
  return String(text || "").toLowerCase().includes(String(term).toLowerCase());
}

export function splitTerms(valuesIn) {
  const out = [];
  for (const value of valuesIn || []) {
    for (const part of String(value).split(/[,\n;|，、]/u)) {
      const term = part.trim();
      if (term) out.push(term);
    }
  }
  return out;
}
