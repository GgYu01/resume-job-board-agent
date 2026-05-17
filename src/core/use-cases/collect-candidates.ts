import { makeCommandResult } from "../../cli/command-result.js";
import type { PageTarget } from "../../browser/browser-port.js";

export async function collectCandidatesFromTargets(input: {
  targets: PageTarget[];
  evaluate(target: PageTarget): Promise<{ accessLimited: boolean; items: unknown[] }>;
}) {
  const items: unknown[] = [];
  const limitedPages: string[] = [];
  for (const target of input.targets) {
    const result = await input.evaluate(target);
    if (result.accessLimited) limitedPages.push(target.url);
    items.push(...result.items);
  }

  if (limitedPages.length) {
    return makeCommandResult({
      category: "access_limited",
      message: "One or more collection pages are access limited.",
      payload: { items, limited_pages: limitedPages },
      nextAction: "Resolve verification in Edge Beta and retry collect.",
    });
  }

  return makeCommandResult({
    category: "success",
    message: "Candidate collection completed.",
    payload: { items, limited_pages: [] },
  });
}
