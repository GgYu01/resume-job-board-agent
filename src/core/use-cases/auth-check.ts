import { makeCommandResult, type CommandResult } from "../../cli/command-result.js";

export interface AuthSiteResult {
  site: string;
  status: string;
  accessLimited: boolean;
}

export function summarizeAuthResults(results: AuthSiteResult[]): CommandResult {
  const limited = results.filter((result) => result.accessLimited || result.status === "access-limited");
  if (limited.length) {
    return makeCommandResult({
      category: "access_limited",
      message: "One or more sites require user action.",
      payload: { results },
      nextAction: "Resolve captcha or verification in Edge Beta, then retry auth.",
    });
  }

  const missing = results.filter((result) => result.status !== "logged-in" && result.status !== "probably-logged-in");
  if (missing.length) {
    return makeCommandResult({
      category: "auth_required",
      message: "One or more sites require login.",
      payload: { results },
      nextAction: "Open the login page in Edge Beta, then retry auth.",
    });
  }

  return makeCommandResult({
    category: "success",
    message: "All requested sites are authenticated.",
    payload: { results },
  });
}
