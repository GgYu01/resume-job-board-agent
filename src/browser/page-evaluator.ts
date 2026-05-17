import type { PageTarget } from "./browser-port.js";

export interface PageEvaluator {
  evaluate<T>(target: PageTarget, expression: string): Promise<T>;
}

export async function evaluateJsonExpression<T>(
  evaluator: PageEvaluator,
  target: PageTarget,
  expression: string,
): Promise<T> {
  const result = await evaluator.evaluate<string | T>(target, expression);
  return typeof result === "string" ? JSON.parse(result) as T : result;
}
