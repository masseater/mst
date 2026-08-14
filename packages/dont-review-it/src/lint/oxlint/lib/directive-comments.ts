import { firstToken } from "@mst/lint-rule-authoring";

import type { Comment } from "@oxlint/plugins";

const commentBlockAbove = (comments: readonly Comment[], line: number): readonly Comment[] => {
  const adjacent = comments.find((comment) => comment.loc.end.line === line - 1);
  if (adjacent === undefined) return [];
  return [...commentBlockAbove(comments, adjacent.loc.start.line), adjacent];
};

export const MOCK_FACTORY_EXEMPTION_DIRECTIVE = "mock-factory-exemption";

export const DIRECTIVE_GROUNDS_SEPARATOR = /\s--\s/u;

const WHITESPACE = /\s+/u;

export type WrittenExemption = {
  readonly comment: Comment;
  readonly grounds: string;
};

const exemptionIn = (comment: Comment, ruleName: string): WrittenExemption | null => {
  const spelled = comment.value.trim();
  if (firstToken(spelled) !== MOCK_FACTORY_EXEMPTION_DIRECTIVE) return null;

  const written = spelled.slice(MOCK_FACTORY_EXEMPTION_DIRECTIVE.length);
  const separated = DIRECTIVE_GROUNDS_SEPARATOR.exec(written);
  const named = separated === null ? written : written.slice(0, separated.index);
  if (!named.split(WHITESPACE).includes(ruleName)) return null;

  const grounds = separated === null ? "" : written.slice(separated.index + separated[0].length);
  return { comment, grounds: grounds.trim() };
};

export const exemptionsWrittenAbove = (input: {
  readonly comments: readonly Comment[];
  readonly line: number;
  readonly ruleName: string;
}): readonly WrittenExemption[] =>
  commentBlockAbove(input.comments, input.line)
    .map((comment) => exemptionIn(comment, input.ruleName))
    .filter((written) => written !== null);
