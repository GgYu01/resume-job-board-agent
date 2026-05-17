import { z } from "zod";

export const artifactBaseSchema = z.object({
  schema_version: z.string().min(1),
  artifact_type: z.string().min(1),
  created_at: z.string().datetime(),
  producer: z.literal("job-board-harness"),
  run_id: z.string().optional(),
  input_artifacts: z.array(z.string()),
  meta: z.record(z.string(), z.unknown()),
});

export const runStageResultSchema = z.object({
  stage: z.string().min(1),
  status: z.enum(["passed", "failed", "skipped", "blocked"]),
  exit_code: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  started_at: z.string().datetime(),
  finished_at: z.string().datetime(),
  input_artifacts: z.array(z.string()),
  output_artifacts: z.array(z.string()),
  warnings: z.array(z.string()),
  requires_user_action: z.boolean(),
  recoverable: z.boolean(),
  next_action: z.string(),
});

export const runManifestSchema = artifactBaseSchema.extend({
  schema_version: z.literal("RunManifest.v1"),
  artifact_type: z.literal("RunManifest"),
  run_id: z.string().min(1),
  stages: z.array(runStageResultSchema),
});
