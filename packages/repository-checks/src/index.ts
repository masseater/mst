export type { CheckOutcome, ScannedProblems } from "./check-outcome.ts";
export { measureCheck } from "./check-telemetry.ts";
export {
  createCliRunner,
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  type CliResult,
} from "./cli-result.ts";
export { gitExecutablePath } from "./git-executable.ts";
export { failureCodeOf, readUnlessMissing } from "./path-failure.ts";
export type { RepositoryProblem } from "./problem.ts";
