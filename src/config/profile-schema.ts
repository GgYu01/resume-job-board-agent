import { z } from "zod";

const weightedTermSchema = z.union([
  z.string().min(1),
  z.object({
    term: z.string().min(1),
    weight: z.number().optional(),
  }).passthrough(),
]);

const termListSchema = z.array(weightedTermSchema).default([]);

export const roleProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  version: z.number().int().positive().default(1),
  must_have: termListSchema,
  should_have: termListSchema,
  nice_to_have: termListSchema,
  negative: termListSchema,
  hard_filters: z.record(z.string(), z.unknown()).default({}),
  ranking_policy: z.record(z.string(), z.unknown()).default({}),
  review_policy: z.record(z.string(), z.unknown()).default({}),
  batch_policy: z.record(z.string(), z.unknown()).default({}),
}).passthrough();

export type RoleProfileConfig = z.infer<typeof roleProfileSchema>;

export function validateRoleProfileConfig(input: unknown):
  | { ok: true; value: RoleProfileConfig }
  | { ok: false; error: string } {
  const parsed = roleProfileSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: parsed.error.message };
}
