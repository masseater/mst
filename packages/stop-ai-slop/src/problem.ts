import type { LocatedProblem } from "@mst/utils";

export type CheckProblem = LocatedProblem;

export type SlopProblem = CheckProblem & {
  readonly checkId: string;
};

export const formatProblem = ({ checkId, file, line, message }: SlopProblem): string =>
  `${file}:${line} ${checkId}: ${message}`;
