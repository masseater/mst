import { CHECKS } from "./check-registry.ts";

import type { SlopCheck } from "./check.ts";
import type { SlopProblem } from "./problem.ts";
import type { RepositoryComparison } from "./repository-comparison.ts";

export const runChecks = ({
  comparison,
  checks = CHECKS,
}: {
  readonly comparison: RepositoryComparison;
  readonly checks?: readonly SlopCheck[];
}): readonly SlopProblem[] =>
  checks.flatMap((check) =>
    check.run(comparison).map((problem) => ({ ...problem, checkId: check.id })),
  );
