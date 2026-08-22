import { uniq } from "es-toolkit";

import { matchesAnchoredGlobPath } from "../glob-path-match.ts";
import { bareRuleNameOf } from "./suppression-directives.ts";

import type { Options } from "@oxlint/plugins";

type DeclaredFields = Readonly<Record<string, Options[number]>>;

const PROTECTED_RULES: readonly string[] = [
  "forbid-javascript-source-file--author-in-typescript",
  "forbid-target-file--delete-or-relocate",
  "forbid-declared-module-import--use-declared-replacement",
  "forbid-module-import-outside-owner--import-through-owner",
  "forbid-unlisted-specifier-form--use-permitted-form",
  "forbid-declared-export-reference--use-declared-replacement",
  "no-retired-tool-in-manifest--use-designated-replacement",
  "require-pinned-runtime-direct-execution--invoke-canonical-entry",
  "no-shell-logic-outside-bootstrap--move-to-typescript-command",
  "no-repository-root-script-directory--own-by-workspace-or-package",
  "no-pre-install-external-dependency--use-builtin-or-relative",
  "forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier",
  "forbid-restricted-target-relay--delete-the-relay",
  "forbid-declared-command-invocation--use-designated-replacement",
  "forbid-tracked-path--untrack-and-ignore",
  "require-registered-file--restore-it-at-the-registered-path",
  "no-mixed-package-surface--declare-one-surface",
  "no-inline-suppression-of-protected-rule--register-the-exception-in-configuration",
  "forbid-generic-restriction-rule--use-the-declared-rule",
  "no-unchecked-authored-path--include-it-in-every-declared-check",
];

export const GENERATED_PATHS: readonly string[] = [
  "**/dist/**",
  "**/coverage/**",
  "**/node_modules/**",
  "**/generated/**",
  "**/__snapshots__/**",
  "**/*.d.ts",
  "**/*.min.*",
  "**/*-min.*",
  "**/*_min.*",
];

export const isGeneratedLintPath = (relativePath: string): boolean =>
  GENERATED_PATHS.some((pattern) => matchesAnchoredGlobPath({ relativePath, pattern }));

export type ProtectionDeviation = {
  readonly rule: string;
  readonly grounds: string;
};

export type ProtectionSettings = {
  readonly addedRules: readonly string[];
  readonly deviations: readonly ProtectionDeviation[];
  readonly generatedPaths: readonly string[];
  readonly suppressionSpellings: readonly string[];
};

export const PROTECTION_SCHEMA = {
  type: "object",
  properties: {
    protectedRules: { type: "array", items: { type: "string" } },
    unprotected: {
      type: "array",
      items: {
        type: "object",
        properties: { rule: { type: "string" }, reason: { type: "string" } },
        required: ["rule"],
        additionalProperties: false,
      },
    },
    generatedPaths: { type: "array", items: { type: "string" } },
    suppressionSpellings: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
} as const;

const declaredFieldsIn = (ruleOptions: Readonly<Options>): DeclaredFields => {
  const [declared] = ruleOptions;
  const spelled = typeof declared === "object" && declared !== null && !Array.isArray(declared);
  return spelled ? declared : {};
};

const spelledTextsAt = ({
  fields,
  key,
}: {
  readonly fields: DeclaredFields;
  readonly key: string;
}): readonly string[] => {
  const listed = fields[key];
  if (!Array.isArray(listed)) return [];
  return listed.filter((candidate): candidate is string => typeof candidate === "string");
};

const deviationOf = (listed: Options[number]): readonly ProtectionDeviation[] => {
  if (typeof listed !== "object" || listed === null || Array.isArray(listed)) return [];
  const { rule, reason } = listed;
  if (typeof rule !== "string" || rule === "") return [];
  return [{ rule, grounds: typeof reason === "string" ? reason.trim() : "" }];
};

const deviationsAt = (fields: DeclaredFields): readonly ProtectionDeviation[] => {
  const listed = fields.unprotected;
  return Array.isArray(listed) ? listed.flatMap(deviationOf) : [];
};

export const protectionSettingsIn = (ruleOptions: Readonly<Options>): ProtectionSettings => {
  const fields = declaredFieldsIn(ruleOptions);
  return {
    addedRules: spelledTextsAt({ fields, key: "protectedRules" }),
    deviations: deviationsAt(fields),
    generatedPaths: spelledTextsAt({ fields, key: "generatedPaths" }),
    suppressionSpellings: spelledTextsAt({ fields, key: "suppressionSpellings" }),
  };
};

export const protectedRulesFrom = ({
  settings,
  keptRule,
}: {
  readonly settings: ProtectionSettings;
  readonly keptRule: string;
}): readonly string[] => {
  const lifted = new Set(
    settings.deviations
      .filter(
        (deviation) => deviation.grounds !== "" && bareRuleNameOf(deviation.rule) !== keptRule,
      )
      .map((deviation) => bareRuleNameOf(deviation.rule)),
  );
  return uniq([...PROTECTED_RULES, ...settings.addedRules, keptRule]).filter(
    (rule) => !lifted.has(bareRuleNameOf(rule)),
  );
};
