import type { CheckReport } from "./run-checks.ts";

export const checkReportLines = ({
  problems,
  warnings,
}: Pick<CheckReport, "problems" | "warnings">): readonly string[] => [
  ...problems,
  ...warnings.map((warning) => `warning: ${warning}`),
];
