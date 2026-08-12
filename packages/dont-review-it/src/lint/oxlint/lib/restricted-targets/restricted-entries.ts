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

export const isJsonObject = (held: unknown): held is Readonly<Record<string, unknown>> =>
  typeof held === "object" && held !== null && !Array.isArray(held);

const declaredListOf = (ruleOptions: Context["options"], named: string): readonly unknown[] => {
  const [first] = ruleOptions;
  if (!isJsonObject(first)) return [];
  const declared = first[named];
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
  ruleOptions: Context["options"],
): readonly RestrictedTargetEntry[] =>
  declaredListOf(ruleOptions, "restricted")
    .map(entryOf)
    .filter((candidate) => candidate !== null);

export const internalAliasesFrom = (ruleOptions: Context["options"]): readonly InternalAlias[] =>
  declaredListOf(ruleOptions, "internalAliases")
    .map(aliasOf)
    .filter((alias) => alias !== null);

const namesModule = (listed: RestrictedTargetEntry, specifier: string): boolean =>
  specifier === listed.module || specifier.startsWith(`${listed.module}/`);

const coversExported = (listed: RestrictedTargetEntry, exported: string | null): boolean =>
  listed.exports.length === 0 || exported === null || listed.exports.includes(exported);

export const matchingRestrictedTarget = ({
  entries,
  forwarded,
}: {
  readonly entries: readonly RestrictedTargetEntry[];
  readonly forwarded: ForwardedTarget;
}): RestrictedTargetEntry | null =>
  entries.find(
    (listed) =>
      namesModule(listed, forwarded.specifier) && coversExported(listed, forwarded.exported),
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
    (listed) =>
      !listed.allowedPositions.some((pattern) => matchesGlobPath({ pathSegments, pattern, cwd })),
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
