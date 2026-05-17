export function buildAgentReviewInput(input: {
  candidates: unknown[];
  profileId: string;
  topN: number;
}): { profile_id: string; candidates: unknown[]; guardrails: { no_external_actions: true } } {
  return {
    profile_id: input.profileId,
    candidates: input.candidates.slice(0, input.topN),
    guardrails: { no_external_actions: true },
  };
}
