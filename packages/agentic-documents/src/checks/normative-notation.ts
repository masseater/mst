import type { AgenticDocumentsConfig } from "../config.ts";

const escapeForPattern = (literal: string): string =>
  literal.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const keywordAlternation = (keywords: readonly string[]): string =>
  keywords.map(escapeForPattern).join("|");

export const keywordStatementPattern = (config: AgenticDocumentsConfig): RegExp =>
  new RegExp(`(?<![A-Za-z])(?:${keywordAlternation(config.decisionKeywords)})\\s*:`, "gu");

export const negatedKeywordPattern = (config: AgenticDocumentsConfig): RegExp =>
  new RegExp(`(?:${keywordAlternation(config.negatedKeywords)})\\s*:`, "gu");

const leadingKeywordPattern = (config: AgenticDocumentsConfig): RegExp =>
  new RegExp(`^(?:${keywordAlternation(config.decisionKeywords)})\\s*:\\s*`, "u");

const conditionPrefixPattern = /^IF:([^;]+);\s*THEN\b\s*/u;

export const actionClauseOf = ({
  text,
  config,
}: {
  readonly text: string;
  readonly config: AgenticDocumentsConfig;
}): string | null => {
  const withoutCondition = text.replace(conditionPrefixPattern, "");
  const keywordMatch = leadingKeywordPattern(config).exec(withoutCondition);
  return keywordMatch === null ? null : withoutCondition.slice(keywordMatch[0].length);
};

export const conditionOf = (writtenText: string): string | null => {
  const condition = conditionPrefixPattern.exec(writtenText)?.[1];
  return condition === undefined ? null : condition.trim();
};
