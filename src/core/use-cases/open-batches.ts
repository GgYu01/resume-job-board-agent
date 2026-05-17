import { makeCommandResult } from "../../cli/command-result.js";

export function planOpenBatch(input: {
  queue: { items: Array<{ index: number; status: string; record: Record<string, unknown> }> };
  openedKeys: Set<string>;
  options: { dryRun: boolean; maxPerBatch: number; triggerContact: boolean; allowExternalAction?: boolean };
}) {
  if (input.options.triggerContact && !input.options.allowExternalAction) {
    return makeCommandResult({
      category: "external_action_blocked",
      message: "Contact trigger requires explicit external-action permission.",
      payload: { triggerContact: true },
      nextAction: "Ask the user to confirm contact triggering for selected records.",
    });
  }

  const pending = input.queue.items.filter((item) => item.status === "pending");
  const toOpen = pending
    .filter((item) => !input.openedKeys.has(String(item.record.id ?? item.record.url ?? "")))
    .slice(0, input.options.maxPerBatch)
    .map((item) => item.record);

  return makeCommandResult({
    category: "success",
    message: "Open batch planned.",
    payload: {
      toOpen,
      browserMutationAllowed: !input.options.dryRun,
    },
  });
}
