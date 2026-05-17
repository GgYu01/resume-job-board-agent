export function selectReviewedCandidates(input: {
  ranked: Array<{ id?: string; canonical_key?: string }>;
  review: { selection?: Array<{ id: string; decision: string }> };
}): { selectedIds: string[]; rejectedIds: string[] } {
  const allowed = new Set(input.ranked.map((record) => record.id ?? record.canonical_key).filter((id): id is string => Boolean(id)));
  const selectedIds: string[] = [];
  for (const item of input.review.selection ?? []) {
    if (allowed.has(item.id) && item.decision === "select") selectedIds.push(item.id);
  }
  return {
    selectedIds,
    rejectedIds: [...allowed].filter((id) => !selectedIds.includes(id)),
  };
}
