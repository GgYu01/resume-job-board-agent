export function summarizeFeedback(input: { opened: number; duplicate: number; accessLimited: number }): {
  precision_denominator: number;
  duplicate_count: number;
  access_limited_count: number;
} {
  return {
    precision_denominator: input.opened,
    duplicate_count: input.duplicate,
    access_limited_count: input.accessLimited,
  };
}
