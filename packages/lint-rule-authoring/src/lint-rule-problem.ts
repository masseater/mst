export type LintRuleProblem = {
  readonly file: string;
  readonly message: string;
};

export const formatLintRuleProblem = ({ file, message }: LintRuleProblem): string =>
  `${file} ${message}`;

export type LintRuleCheckReport = {
  readonly problems: readonly LintRuleProblem[];
  readonly scanned: number;
};
