import type { ExitCategory } from "./command-result.js";

export class HarnessError extends Error {
  readonly category: ExitCategory;
  readonly payload: Record<string, unknown>;
  readonly nextAction?: string;

  constructor(input: {
    category: ExitCategory;
    message: string;
    payload?: Record<string, unknown>;
    nextAction?: string;
  }) {
    super(input.message);
    this.name = "HarnessError";
    this.category = input.category;
    this.payload = input.payload ?? {};
    this.nextAction = input.nextAction;
  }
}
