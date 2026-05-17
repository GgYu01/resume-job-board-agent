export interface RankRecord {
  site?: string;
  id?: string;
  url: string;
  titleText?: string;
  cardText?: string;
}

export interface RankProfile {
  include?: string[];
  exclude?: string[];
  hard_filters?: Record<string, unknown>;
}

export interface RankOptions {
  max: number;
  minScore: number;
}

export interface RankedRecord extends RankRecord {
  score: number;
  canonical_key: string;
  reasons: string[];
  penalties: string[];
}

function canonicalKey(record: RankRecord): string {
  const site = record.site ?? "unknown";
  const id = record.id ?? record.url;
  return `${site}:${id}`;
}

function hit(text: string, term: string): boolean {
  return text.toLowerCase().includes(term.toLowerCase());
}

export function rankCandidates(input: {
  records: RankRecord[];
  profile: RankProfile;
  options: RankOptions;
}): { selected: RankedRecord[]; ranked: RankedRecord[]; rejected: RankedRecord[] } {
  const include = input.profile.include ?? [];
  const exclude = input.profile.exclude ?? [];
  const ranked = input.records.map((record) => {
    const text = `${record.titleText ?? ""}\n${record.cardText ?? ""}`;
    const reasons = include.filter((term) => hit(text, term));
    const penalties = exclude.filter((term) => hit(text, term));
    const score = reasons.length * 20 - penalties.length * 40;
    return { ...record, score, canonical_key: canonicalKey(record), reasons, penalties };
  }).sort((a, b) => b.score - a.score);
  const selected = ranked.filter((record) => record.score >= input.options.minScore).slice(0, input.options.max);
  const selectedKeys = new Set(selected.map((record) => record.canonical_key));
  const rejected = ranked.filter((record) => !selectedKeys.has(record.canonical_key));
  return { selected, ranked, rejected };
}
