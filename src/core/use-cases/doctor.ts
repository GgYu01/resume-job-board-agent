import { makeCommandResult, type CommandResult } from "../../cli/command-result.js";

export async function runDoctor(input: {
  browser: { doctor(): Promise<{ available: boolean; problem?: string; endpoint?: unknown }> };
  now(): string;
}): Promise<CommandResult> {
  const browser = await input.browser.doctor();
  if (!browser.available) {
    return makeCommandResult({
      category: "browser_unavailable",
      message: browser.problem ?? "Edge Beta CDP is unavailable.",
      payload: { checked_at: input.now(), browser },
      nextAction: "Start the Edge Beta CDP browser, then retry doctor.",
    });
  }

  return makeCommandResult({
    category: "success",
    message: "Doctor checks passed.",
    payload: { checked_at: input.now(), browser },
  });
}
