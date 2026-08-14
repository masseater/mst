import { resolve, sep } from "node:path";

import { matchesGlobPath } from "../glob-path-match.ts";
import { listedTexts } from "../listed-texts.ts";
import { isNamedFields } from "../named-fields.ts";
import { segmentsOf } from "../path-segments.ts";

import type { Context, RuleMeta } from "@oxlint/plugins";

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

const declaredListOf = (
  ruleSettings: Context["options"],
  settingField: string,
): readonly unknown[] => {
  const [first] = ruleSettings;
  if (!isNamedFields(first)) return [];
  const declared = first[settingField];
  return Array.isArray(declared) ? declared : [];
};

export type RestrictedTargetEntry = {
  readonly module: string;
  readonly exports: readonly string[];
  readonly allowedPositions: readonly string[];
  readonly substitute: string;
};

const entryOf = (held: unknown): RestrictedTargetEntry | null => {
  if (!isNamedFields(held)) return null;
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

export const restrictedTargetsFrom = (
  ruleSettings: Context["options"],
): readonly RestrictedTargetEntry[] =>
  declaredListOf(ruleSettings, "restricted")
    .map(entryOf)
    .filter((restrictedTarget) => restrictedTarget !== null);

export type InternalAlias = {
  readonly prefix: string;
  readonly directory: string;
};

const aliasOf = (held: unknown): InternalAlias | null => {
  if (!isNamedFields(held)) return null;
  const { prefix, directory } = held;
  if (typeof prefix !== "string" || prefix === "") return null;
  return typeof directory === "string" ? { prefix, directory } : null;
};

export const internalAliasesFrom = (ruleSettings: Context["options"]): readonly InternalAlias[] =>
  declaredListOf(ruleSettings, "internalAliases")
    .map(aliasOf)
    .filter((alias) => alias !== null);

const namesModule = (restrictedTarget: RestrictedTargetEntry, specifier: string): boolean =>
  specifier === restrictedTarget.module || specifier.startsWith(`${restrictedTarget.module}/`);

const coversExported = (
  restrictedTarget: RestrictedTargetEntry,
  exported: string | null,
): boolean =>
  restrictedTarget.exports.length === 0 ||
  exported === null ||
  restrictedTarget.exports.includes(exported);

export type ForwardedTarget = {
  readonly specifier: string;
  readonly exported: string | null;
};

export const matchingRestrictedTarget = ({
  entries,
  forwarded,
}: {
  readonly entries: readonly RestrictedTargetEntry[];
  readonly forwarded: ForwardedTarget;
}): RestrictedTargetEntry | null =>
  entries.find(
    (restrictedTarget) =>
      namesModule(restrictedTarget, forwarded.specifier) &&
      coversExported(restrictedTarget, forwarded.exported),
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
    (restrictedTarget) =>
      !restrictedTarget.allowedPositions.some((pattern) =>
        matchesGlobPath({ pathSegments, pattern, cwd }),
      ),
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
