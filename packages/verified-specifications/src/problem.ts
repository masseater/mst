import type { RepositoryProblem } from "@mst/utils";

export const formatSpecificationProblem = (problem: RepositoryProblem): string =>
  [
    problem.file,
    problem.line === null ? "" : `:${String(problem.line)}`,
    " ",
    problem.message,
  ].join("");
