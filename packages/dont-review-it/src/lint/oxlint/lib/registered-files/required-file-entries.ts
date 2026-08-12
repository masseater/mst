import type { Context, RuleMeta } from "@oxlint/plugins";

export type RequiredFileEntry = {
  readonly pattern: string;
  readonly owner: string | null;
  readonly reason: string;
  readonly contentChecks: readonly string[];
};

export const REQUIRED_FILE_SCHEMA: RuleMeta["schema"] = [
  {
    type: "object",
    properties: {
      requiredFiles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            pattern: { type: "string" },
            owner: { type: "string" },
            reason: { type: "string" },
            contentChecks: { type: "array", items: { type: "string" } },
          },
          required: ["pattern", "reason"],
          additionalProperties: false,
        },
      },
      unscannedDirectories: { type: "array", items: { type: "string" } },
    },
    additionalProperties: false,
  },
];

type DeclaredRequiredFile = {
  readonly pattern?: unknown;
  readonly owner?: unknown;
  readonly reason?: unknown;
  readonly contentChecks?: readonly unknown[];
};

const spelledTextOf = (held: unknown): string | null =>
  typeof held === "string" && held !== "" ? held : null;

const entryOf = (declared: DeclaredRequiredFile): RequiredFileEntry | null => {
  const pattern = spelledTextOf(declared.pattern);
  const reason = spelledTextOf(declared.reason);
  if (pattern === null || reason === null) return null;

  return {
    pattern,
    owner: spelledTextOf(declared.owner),
    reason,
    contentChecks: (declared.contentChecks ?? []).filter(
      (spelled): spelled is string => typeof spelled === "string",
    ),
  };
};

export const requiredFilesFrom = (ruleOptions: Context["options"]): readonly RequiredFileEntry[] =>
  (
    ((ruleOptions[0] ?? {}) as { readonly requiredFiles?: readonly DeclaredRequiredFile[] })
      .requiredFiles ?? []
  )
    .map(entryOf)
    .filter((candidate) => candidate !== null);
