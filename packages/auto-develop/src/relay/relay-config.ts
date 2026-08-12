import { z } from "zod";

import { readEnvVar } from "../config/env.ts";

const relayConfigSchema = z
  .object({
    port: z.coerce.number().int().min(1).max(65535).default(8080),
    githubRepository: z.string().regex(/^[^\s/]+\/[^\s/]+$/),
    webhookSecret: z.string().min(1),
    schedulerServiceAccountEmails: z.array(z.string().min(1)).default([]),
    publicOrigin: z.url().optional(),
    githubApiOrigin: z.url().default("https://api.github.com"),
    ciSuppressionLabel: z.string().min(1).optional(),
  })
  .refine(
    (config) =>
      config.schedulerServiceAccountEmails.length === 0 || config.publicOrigin !== undefined,
    { message: "publicOrigin is required when schedulerServiceAccountEmails is set" },
  );

export type RelayConfig = z.output<typeof relayConfigSchema>;

export const relayConfigFromEnv = (
  env: Readonly<Record<string, unknown>> = process.env,
): RelayConfig => {
  const port = readEnvVar("PORT", env);
  const schedulerEmails = readEnvVar("SCHEDULER_SERVICE_ACCOUNT_EMAILS", env);
  const publicOrigin = readEnvVar("RELAY_PUBLIC_ORIGIN", env);
  const githubApiOrigin = readEnvVar("GITHUB_API_ORIGIN", env);
  const ciSuppressionLabel = readEnvVar("CI_SUPPRESSION_LABEL", env);
  return relayConfigSchema.parse({
    githubRepository: readEnvVar("GITHUB_REPOSITORY", env),
    webhookSecret: readEnvVar("GITHUB_WEBHOOK_SECRET", env),
    ...(port === undefined ? {} : { port }),
    ...(schedulerEmails === undefined
      ? {}
      : {
          schedulerServiceAccountEmails: schedulerEmails
            .split(",")
            .map((email) => email.trim())
            .filter((email) => email !== ""),
        }),
    ...(publicOrigin === undefined ? {} : { publicOrigin }),
    ...(githubApiOrigin === undefined ? {} : { githubApiOrigin }),
    ...(ciSuppressionLabel === undefined ? {} : { ciSuppressionLabel }),
  });
};
