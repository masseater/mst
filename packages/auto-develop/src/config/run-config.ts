import { z } from "zod";

import { DEFAULT_ENGINE, ENGINES } from "./engine.ts";

export const runConfigSchema = z.object({
  engine: z.enum(ENGINES).default(DEFAULT_ENGINE),
  engineOverride: z.string().optional(),
  concurrency: z.coerce.number().min(1).default(3),
  dryRun: z.boolean().default(false),
  targetPrs: z.array(z.number()).default([]),
  excludedPrs: z.array(z.number()).default([]),
  pullOnRestart: z.boolean().optional(),
  ghUser: z.string().min(1).optional(),
  dangerouslySkipPermissions: z.boolean().default(false),
});
