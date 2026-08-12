import type { RepositoryProblem } from "./problem.ts";

export type CheckOutcome = {
  readonly check: string;
  readonly unit: string;
  readonly count: number;
  readonly skippedReason: string | null;
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
};

export type ScannedProblems = {
  readonly problems: readonly RepositoryProblem[];
  readonly scanned: number;
};
