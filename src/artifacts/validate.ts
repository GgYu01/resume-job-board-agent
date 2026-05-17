import { artifactBaseSchema, runManifestSchema } from "./schemas.js";

export type ValidationResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

function parse(
  schema: { safeParse(input: unknown): { success: boolean; data?: unknown; error?: { message: string } } },
  input: unknown,
): ValidationResult {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error?.message ?? "Invalid artifact" };
}

export function validateArtifactBase(input: unknown): ValidationResult {
  return parse(artifactBaseSchema, input);
}

export function validateRunManifest(input: unknown): ValidationResult {
  return parse(runManifestSchema, input);
}
