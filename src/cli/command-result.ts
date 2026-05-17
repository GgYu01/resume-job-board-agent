export type ExitCategory =
  | "success"
  | "auth_required"
  | "access_limited"
  | "browser_unavailable"
  | "config_error"
  | "data_error"
  | "external_action_blocked"
  | "internal_error";

export type ExitCode = 0 | 1 | 2 | 3 | 4 | 5;

export interface CommandResult<TPayload = unknown> {
  ok: boolean;
  exitCode: ExitCode;
  category: ExitCategory;
  message: string;
  payload: TPayload;
  artifacts?: Record<string, string>;
  nextAction?: string;
}

export function exitCodeForCategory(category: ExitCategory): ExitCode {
  switch (category) {
    case "success":
      return 0;
    case "internal_error":
      return 1;
    case "config_error":
    case "data_error":
      return 2;
    case "auth_required":
    case "access_limited":
      return 3;
    case "browser_unavailable":
      return 4;
    case "external_action_blocked":
      return 5;
  }
}

export function makeCommandResult<TPayload>(input: {
  category: ExitCategory;
  message: string;
  payload: TPayload;
  artifacts?: Record<string, string>;
  nextAction?: string;
}): CommandResult<TPayload> {
  const exitCode = exitCodeForCategory(input.category);
  return {
    ok: exitCode === 0,
    exitCode,
    category: input.category,
    message: input.message,
    payload: input.payload,
    ...(input.artifacts ? { artifacts: input.artifacts } : {}),
    ...(input.nextAction ? { nextAction: input.nextAction } : {}),
  };
}
