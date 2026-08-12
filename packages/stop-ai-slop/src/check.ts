import type { CheckProblem } from "./problem.ts";
import type { RepositoryComparison } from "./repository-comparison.ts";

export type SlopCheck = {
  readonly id: string;
  readonly run: (comparison: RepositoryComparison) => readonly CheckProblem[];
};
