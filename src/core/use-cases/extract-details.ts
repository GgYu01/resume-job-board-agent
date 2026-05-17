export function mergeDetailRecords(input: {
  selected: Array<Record<string, unknown>>;
  details: Array<Record<string, unknown>>;
}): Array<Record<string, unknown>> {
  const detailsById = new Map(input.details.map((record) => [String(record.id), record]));
  return input.selected.map((record) => {
    const detail = detailsById.get(String(record.id)) ?? {};
    return { ...record, ...detail };
  });
}
