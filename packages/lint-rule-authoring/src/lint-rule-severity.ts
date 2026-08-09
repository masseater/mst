export const LINT_RULE_SEVERITIES = ["error", "warn", "off"] as const;

export type LintRuleSeverity = (typeof LINT_RULE_SEVERITIES)[number];

export const LINT_SEVERITY = {
  ERROR: LINT_RULE_SEVERITIES[0],
  WARN: LINT_RULE_SEVERITIES[1],
  OFF: LINT_RULE_SEVERITIES[2],
} as const;
