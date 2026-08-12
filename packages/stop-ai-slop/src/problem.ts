export type CheckProblem = {
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

export type SlopProblem = CheckProblem & {
  readonly checkId: string;
};

export const formatProblem = ({ checkId, file, line, message }: SlopProblem): string =>
  `${file}:${line} ${checkId}: ${message}`;
