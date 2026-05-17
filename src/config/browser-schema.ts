import { z } from "zod";

export const browserPolicySchema = z.object({
  required_family: z.literal("edge-beta").default("edge-beta"),
  allow_fallback_family: z.boolean().default(false),
  require_cdp: z.boolean().default(true),
  require_dedicated_profile: z.boolean().default(true),
});

export const browserConfigSchema = z.object({
  browser_exe: z.string().nullable().optional(),
  browser_profile: z.string().nullable().optional(),
  browser_policy: browserPolicySchema.default({
    required_family: "edge-beta",
    allow_fallback_family: false,
    require_cdp: true,
    require_dedicated_profile: true,
  }),
}).passthrough();

export type BrowserConfig = z.infer<typeof browserConfigSchema>;
