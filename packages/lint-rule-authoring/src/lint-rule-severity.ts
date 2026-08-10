import type { AllowWarnDeny } from "oxlint";

export type LintRuleSeverity = Extract<AllowWarnDeny, "error" | "warn" | "off">;

export const LINT_RULE_SEVERITIES = [
  "error",
  "warn",
  "off",
] as const satisfies readonly LintRuleSeverity[];

export const LINT_SEVERITY = {
  ERROR: LINT_RULE_SEVERITIES[0],
  WARN: LINT_RULE_SEVERITIES[1],
  OFF: LINT_RULE_SEVERITIES[2],
} as const;
