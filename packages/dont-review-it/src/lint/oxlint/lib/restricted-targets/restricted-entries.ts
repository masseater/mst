import { resolve, sep } from "node:path";

import { matchesGlobPath } from "../glob-path-match.ts";
import { listedTexts } from "../listed-texts.ts";
import { segmentsOf } from "../path-segments.ts";

import type { Context, RuleMeta } from "@oxlint/plugins";

export type RestrictedTargetEntry = {
  readonly module: string;
  readonly exports: readonly string[];
  readonly allowedPositions: readonly string[];
  readonly substitute: string;
};

export type InternalAlias = {
  readonly prefix: string;
  readonly directory: string;
};

export type ForwardedTarget = {
  readonly specifier: string;
  readonly exported: string | null;
};

export const RESTRICTED_TARGET_SCHEMA: RuleMeta["schema"] = [
  {
    type: "object",
    properties: {
      restricted: {
        type: "array",
        items: {
          type: "object",
          properties: {
            module: { type: "string" },
            exports: { type: "array", items: { type: "string" } },
            allowedPositions: { type: "array", items: { type: "string" } },
            substitute: { type: "string" },
          },
          required: ["module", "substitute"],
          additionalProperties: false,
        },
      },
      internalAliases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            prefix: { type: "string" },
            directory: { type: "string" },
          },
          required: ["prefix", "directory"],
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
];

const isJsonObject = (held: unknown): held is Readonly<Record<string, unknown>> =>
  typeof held === "object" && held !== null && !Array.isArray(held);

const declaredListOf = (options: Context["options"], key: string): readonly unknown[] => {
  const [first] = options;
  if (!isJsonObject(first)) return [];
  const declared = first[key];
  return Array.isArray(declared) ? declared : [];
};

const entryOf = (held: unknown): RestrictedTargetEntry | null => {
  if (!isJsonObject(held)) return null;
  const { module, substitute } = held;
  if (typeof module !== "string" || module === "") return null;
  if (typeof substitute !== "string") return null;

  return {
    module,
    exports: listedTexts(held.exports),
    allowedPositions: listedTexts(held.allowedPositions),
    substitute,
  };
};

const aliasOf = (held: unknown): InternalAlias | null => {
  if (!isJsonObject(held)) return null;
  const { prefix, directory } = held;
  if (typeof prefix !== "string" || prefix === "") return null;
  return typeof directory === "string" ? { prefix, directory } : null;
};

export const restrictedTargetsFrom = (
  options: Context["options"],
): readonly RestrictedTargetEntry[] =>
  declaredListOf(options, "restricted")
    .map(entryOf)
    .filter((entry) => entry !== null);

export const internalAliasesFrom = (options: Context["options"]): readonly InternalAlias[] =>
  declaredListOf(options, "internalAliases")
    .map(aliasOf)
    .filter((alias) => alias !== null);

const namesModule = (entry: RestrictedTargetEntry, specifier: string): boolean =>
  specifier === entry.module || specifier.startsWith(`${entry.module}/`);

const coversExported = (entry: RestrictedTargetEntry, exported: string | null): boolean =>
  entry.exports.length === 0 || exported === null || entry.exports.includes(exported);

export const matchingRestrictedTarget = ({
  entries,
  forwarded,
}: {
  readonly entries: readonly RestrictedTargetEntry[];
  readonly forwarded: ForwardedTarget;
}): RestrictedTargetEntry | null =>
  entries.find(
    (entry) => namesModule(entry, forwarded.specifier) && coversExported(entry, forwarded.exported),
  ) ?? null;

export const entriesInForceAt = ({
  entries,
  file,
  cwd,
}: {
  readonly entries: readonly RestrictedTargetEntry[];
  readonly file: string;
  readonly cwd: string;
}): readonly RestrictedTargetEntry[] => {
  const pathSegments = segmentsOf({ path: file, separator: sep });
  return entries.filter(
    (entry) =>
      !entry.allowedPositions.some((pattern) => matchesGlobPath({ pathSegments, pattern, cwd })),
  );
};

export const aliasedSpecifierIn = ({
  specifier,
  aliases,
  workspaceRoot,
}: {
  readonly specifier: string;
  readonly aliases: readonly InternalAlias[];
  readonly workspaceRoot: string;
}): string | null => {
  const matched = aliases.find((alias) => specifier.startsWith(alias.prefix));
  if (matched === undefined) return null;

  const remainder = specifier.slice(matched.prefix.length);
  return resolve(workspaceRoot, matched.directory, remainder);
};
