import { DEFAULT_NEGATIVE_TERMS, DEFAULT_POSITIVE_TERMS } from "../config/defaults.mjs";
import { negativeTermsFromProfile, positiveTermsFromProfile, hardFiltersFromProfile } from "../config/load-config.mjs";
import { includesTerm, normalizeText } from "../shared/text.mjs";

export function extractNeedTerms(text, positiveTerms = DEFAULT_POSITIVE_TERMS) {
  const terms = new Set();
  for (const match of String(text || "").matchAll(/[A-Za-z][A-Za-z0-9+#./-]{1,}/g)) {
    const term = match[0].trim();
    if (term.length >= 2) terms.add(term);
  }
  for (const [term] of positiveTerms) {
    if (includesTerm(text, term)) terms.add(term);
  }
  return Array.from(terms);
}

export function firstUsefulLine(record) {
  const text = normalizeText(record.title || record.jobTitle || record.position || record.titleText || record.cardText || "");
  const line = text.split(/\r?\n/).map((part) => part.trim()).find(Boolean);
  return line || "";
}

function recordSearchText(record) {
  return normalizeText([
    record.title,
    record.jobTitle,
    record.position,
    record.company,
    record.city,
    record.location,
    record.salary,
    record.experience,
    record.education,
    record.titleText,
    record.cardText,
    record.matchPoint,
    record.description,
    record.requirements,
    record.responsibilities,
    record.detailText,
    record.intro,
    record.verified_intro,
    record.verified_props,
    record.sourceTitle,
  ].filter(Boolean).join("\n"));
}

function asTermPairs(items, fallbackWeight) {
  return (items || []).map((item) => Array.isArray(item)
    ? { term: item[0], weight: Number(item[1] ?? fallbackWeight), bucket: "default" }
    : { term: item.term, weight: Number(item.weight ?? fallbackWeight), bucket: item.bucket || "profile" }
  ).filter((item) => item.term);
}

function pushHit(hits, { term, weight, field, bucket }) {
  hits.push({ term, weight, field, bucket });
}

function parseSalaryK(value) {
  const text = normalizeText(value);
  if (!text) return null;
  let match = text.match(/(\d+(?:\.\d+)?)\s*(?:-|~|至|到)\s*(\d+(?:\.\d+)?)\s*[kK]/);
  if (match) return Math.max(Number(match[1]), Number(match[2]));
  match = text.match(/(\d+(?:\.\d+)?)\s*[kK]\s*(?:以上|\+|起)?/);
  if (match) return Number(match[1]);
  match = text.match(/(\d+(?:\.\d+)?)\s*(?:-|~|至|到)\s*(\d+(?:\.\d+)?)\s*万/);
  if (match) return Math.round((Math.max(Number(match[1]), Number(match[2])) * 10) / 12);
  return null;
}

function parseExperienceYears(value) {
  const text = normalizeText(value);
  if (!text) return null;
  let match = text.match(/(\d+(?:\.\d+)?)\s*(?:-|~|至|到)\s*(\d+(?:\.\d+)?)\s*(?:年|years?|yrs?)/i);
  if (match) return Math.max(Number(match[1]), Number(match[2]));
  match = text.match(/(\d+(?:\.\d+)?)\s*(?:年|years?|yrs?)/i);
  if (match) return Number(match[1]);
  return null;
}

function optionalNumericLimit(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hardFilter(record, text, filters = {}) {
  const reasons = [];
  if (filters.reject_internship !== false && includesTerm(text, "实习")) reasons.push("internship");
  if (filters.reject_part_time !== false && includesTerm(text, "兼职")) reasons.push("part-time");
  const cities = Array.isArray(filters.cities) ? filters.cities.filter(Boolean) : [];
  if (cities.length) {
    const cityText = normalizeText([record.city, record.location, record.sourceTitle, text].filter(Boolean).join("\n"));
    if (!cities.some((city) => includesTerm(cityText, city))) reasons.push(`city-not-in:${cities.join("|")}`);
  }
  const minSalary = optionalNumericLimit(filters.min_salary);
  if (minSalary !== null) {
    const salaryK = parseSalaryK([record.salary, record.salaryText, record.compensation, text].filter(Boolean).join("\n"));
    if (salaryK !== null && salaryK < minSalary) {
      reasons.push(`salary-below-min:${salaryK}<${minSalary}`);
    }
  }
  const maxExperienceYears = optionalNumericLimit(filters.max_experience_years);
  if (maxExperienceYears !== null) {
    const years = parseExperienceYears([record.experience, record.workYears, record.years, text].filter(Boolean).join("\n"));
    if (years !== null && years > maxExperienceYears) {
      reasons.push(`experience-above-max:${years}>${maxExperienceYears}`);
    }
  }
  return reasons;
}

export function scoreRecord(record, context = {}) {
  const title = firstUsefulLine(record);
  const text = recordSearchText(record);
  let score = 0;
  const matched = [];
  const negative = [];
  const reasons = [];
  const penalties = [];

  const profile = context.profile || null;
  const profilePositive = positiveTermsFromProfile(profile);
  const profileNegative = negativeTermsFromProfile(profile);
  const hardFilters = {
    ...hardFiltersFromProfile(profile),
    ...(context.hardFilters || {}),
  };
  const hardRejected = hardFilter(record, text, hardFilters);

  const useDefaultTerms = profile
    ? profile?.ranking_policy?.use_default_terms === true || context.useDefaultTerms === true
    : context.useDefaultTerms !== false;

  const positiveTerms = [
    ...(useDefaultTerms ? asTermPairs(DEFAULT_POSITIVE_TERMS, 8) : []),
    ...profilePositive,
    ...(context.needTerms || []).map((term) => ({ term, weight: 7, bucket: "need" })),
    ...(context.resumeTerms || []).map((term) => ({ term, weight: 4, bucket: "resume" })),
    ...(context.includeTerms || []).map((term) => ({ term, weight: 12, bucket: "include" })),
  ];

  const seen = new Set();
  for (const item of positiveTerms) {
    const key = String(item.term).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (includesTerm(title, item.term)) {
      const weight = item.weight * 2;
      score += weight;
      reasons.push(`${item.term}:title`);
      pushHit(matched, { ...item, weight, field: "title" });
    } else if (includesTerm(text, item.term)) {
      score += item.weight;
      reasons.push(item.term);
      pushHit(matched, { ...item, field: "text" });
    }
  }

  for (const term of context.excludeTerms || []) {
    if (includesTerm(text, term)) {
      score -= 100;
      penalties.push(`${term}:hard-exclude`);
      negative.push({ term, weight: -100, field: "text", bucket: "exclude" });
    }
  }

  for (const item of [...(useDefaultTerms ? asTermPairs(DEFAULT_NEGATIVE_TERMS, -16) : []), ...profileNegative]) {
    const penalty = Math.abs(Number(item.weight || -16));
    if (includesTerm(title, item.term)) {
      score -= penalty * 2;
      penalties.push(`${item.term}:title`);
      negative.push({ ...item, weight: -penalty * 2, field: "title" });
    } else if (includesTerm(text, item.term)) {
      score -= penalty;
      penalties.push(item.term);
      negative.push({ ...item, weight: -penalty, field: "text" });
    }
  }

  for (const reason of hardRejected) {
    score -= 100;
    penalties.push(`hard-filter:${reason}`);
    negative.push({ term: reason, weight: -100, field: "hard_filter", bucket: "hard_filter" });
  }

  if (!title) {
    score -= 15;
    penalties.push("missing-title");
  }

  return {
    score,
    title,
    reasons: reasons.slice(0, 12),
    penalties: penalties.slice(0, 8),
    explain: {
      matched: matched.slice(0, 24),
      negative: negative.slice(0, 16),
      hard_filters: hardRejected,
      missing: [],
    },
    hardRejected,
  };
}
