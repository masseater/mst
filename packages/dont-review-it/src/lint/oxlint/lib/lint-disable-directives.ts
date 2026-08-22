import { parseSync, type Comment } from "oxc-parser";

export type LintDisableDirective = {
  readonly engine: "eslint" | "oxlint";
  readonly line: number;
  readonly suppressedRules: readonly string[];
};

export const COMMENT_BODY_OFFSET = 2;

const LINT_DISABLE_DIRECTIVE =
  /^[ \t]*(eslint|oxlint)-disable(?:-line|-next-line)?(?=$|[ \t\r\n])(?:[ \t]+([^\n]*))?/gu;

export const lineAt = (sourceText: string, offset: number): number =>
  sourceText.slice(0, offset).split("\n").length;

export const lintDisableDirectivesInComment = ({
  sourceText,
  comment,
}: {
  readonly sourceText: string;
  readonly comment: Comment;
}): readonly LintDisableDirective[] =>
  [...comment.value.matchAll(LINT_DISABLE_DIRECTIVE)].map((match) => {
    const directiveParameters = match[2] ?? "";
    const reason = /(?:^|[ \t]+)--(?:[ \t]+|$)/u.exec(directiveParameters);
    return {
      engine: match[1] === "eslint" ? "eslint" : "oxlint",
      line: lineAt(sourceText, comment.start + COMMENT_BODY_OFFSET + match.index),
      suppressedRules: directiveParameters
        .slice(0, reason?.index ?? directiveParameters.length)
        .split(/[\s,]+/u)
        .filter((suppressedRule) => suppressedRule !== ""),
    };
  });

export const lintDisableDirectivesIn = ({
  sourceName,
  sourceText,
}: {
  readonly sourceName: string;
  readonly sourceText: string;
}): readonly LintDisableDirective[] =>
  parseSync(sourceName, sourceText).comments.flatMap((comment) =>
    lintDisableDirectivesInComment({ sourceText, comment }),
  );

export const diagnosticRuleNameOf = (suppressedRule: string): string =>
  /^[^()]+\(([^()]+)\)$/u.exec(suppressedRule)?.[1] ?? suppressedRule;
