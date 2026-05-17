import { z } from "zod";

export const batchPolicySchema = z.object({
  max_per_batch: z.number().int().positive().max(50).default(15),
  batch_cooldown_ms: z.number().int().nonnegative().default(45000),
  jitter_ms: z.number().int().nonnegative().default(10000),
  stop_on_access_limited: z.boolean().default(true),
});

export type BatchPolicyConfig = z.infer<typeof batchPolicySchema>;
