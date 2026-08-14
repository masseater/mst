import { firstToken } from "@mst/lint-rule-authoring";

import { DIRECTIVE_GROUNDS_SEPARATOR } from "../directive-comments.ts";

const LINE_SCOPED_SPELLINGS: ReadonlySet<string> = new Set([
  "eslint-disable-line",
  "eslint-disable-next-line",
  "oxlint-disable-line",
  "oxlint-disable-next-line",
]);

const WHOLE_FILE_SPELLINGS: ReadonlySet<string> = new Set(["eslint-disable", "oxlint-disable"]);

const RULE_NAME_SEPARATORS = /[\s,]+/u;

export type SuppressionDirective = {
  readonly spelling: string;
  readonly coversWholeFile: boolean;
  readonly ruleNames: readonly string[];
  readonly carriesGrounds: boolean;
};

const groundsSplitOf = (
  written: string,
): { readonly listed: string; readonly grounds: string | null } => {
  const separator = DIRECTIVE_GROUNDS_SEPARATOR.exec(written);
  if (separator === null) return { listed: written, grounds: null };
  return {
    listed: written.slice(0, separator.index),
    grounds: written.slice(separator.index + separator[0].length),
  };
};

const HOLLOW_GROUNDS_WORDS: ReadonlySet<string> = new Set([
  "false",
  "positive",
  "positives",
  "誤検出",
]);

const GROUNDS_WORD_SEPARATORS = /[\s,.;:!?()[\]{}"'`]+/u;

export const bareRuleNameOf = (ruleName: string): string => ruleName.split("/").slice(-1).join("");

const carriesContent = ({
  grounds,
  ruleNames,
}: {
  readonly grounds: string;
  readonly ruleNames: readonly string[];
}): boolean => {
  const named = new Set(ruleNames.map(bareRuleNameOf));
  return grounds
    .split(GROUNDS_WORD_SEPARATORS)
    .some(
      (word) =>
        word !== "" &&
        !named.has(bareRuleNameOf(word)) &&
        !HOLLOW_GROUNDS_WORDS.has(word.toLowerCase()),
    );
};

export const suppressionDirectiveOf = (
  comment: { readonly value: string },
  additionalSpellings: readonly string[] = [],
): SuppressionDirective | null => {
  const spelling = firstToken(comment.value);
  const coversWholeFile =
    WHOLE_FILE_SPELLINGS.has(spelling) || additionalSpellings.includes(spelling);
  if (!coversWholeFile && !LINE_SCOPED_SPELLINGS.has(spelling)) return null;

  const written = comment.value.slice(comment.value.indexOf(spelling) + spelling.length);
  const { listed, grounds } = groundsSplitOf(written);
  const ruleNames = listed.split(RULE_NAME_SEPARATORS).filter((spelled) => spelled !== "");

  return {
    spelling,
    coversWholeFile,
    ruleNames,
    carriesGrounds: grounds !== null && carriesContent({ grounds, ruleNames }),
  };
};

export const coveredRulesOf = ({
  directive,
  targetRules,
}: {
  readonly directive: SuppressionDirective;
  readonly targetRules: readonly string[];
}): readonly string[] => {
  if (directive.ruleNames.length === 0) return targetRules;
  const named = new Set(directive.ruleNames.map(bareRuleNameOf));
  return targetRules.filter((targetRule) => named.has(bareRuleNameOf(targetRule)));
};

export const namesRule = ({
  directive,
  ruleName,
}: {
  readonly directive: SuppressionDirective;
  readonly ruleName: string;
}): boolean => directive.ruleNames.some((named) => bareRuleNameOf(named) === ruleName);
