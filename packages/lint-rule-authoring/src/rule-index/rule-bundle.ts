import { sep } from "node:path";

import type { LintRuleFacts } from "./rule-facts.ts";

const segmentsUnder = ({
  sourcePath,
  ruleDirectory,
}: {
  readonly sourcePath: string;
  readonly ruleDirectory: string;
}): readonly string[] => {
  const prefix = `${ruleDirectory.split("/").join(sep)}${sep}`;
  return sourcePath.startsWith(prefix) ? sourcePath.slice(prefix.length).split(sep) : [];
};

export const bundleNameOf = ({
  sourcePath,
  ruleDirectories,
}: {
  readonly sourcePath: string;
  readonly ruleDirectories: readonly string[];
}): string | null =>
  ruleDirectories
    .map((ruleDirectory) => segmentsUnder({ sourcePath, ruleDirectory }))
    .flatMap((segments) => (segments.length > 1 ? segments.slice(0, 1) : []))
    .at(0) ?? null;

export type BundledLintRule = LintRuleFacts & {
  readonly bundle: string | null;
};

export const bundleNamesIn = (rules: readonly BundledLintRule[]): readonly string[] =>
  [...new Set(rules.flatMap((rule) => (rule.bundle === null ? [] : [rule.bundle])))].toSorted(
    (left, right) => left.localeCompare(right),
  );
