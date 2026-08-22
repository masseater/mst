import {
  diagnosticRuleNameOf,
  lintDisableDirectivesIn,
} from "../lint/oxlint/lib/lint-disable-directives.ts";

import type { RepositoryProblem } from "@mst/repository-checks";
import type { PresetAdoptionConfig } from "./config.ts";

const targetsGuardRule = (
  suppressedRules: readonly string[],
  config: PresetAdoptionConfig,
): boolean =>
  suppressedRules.some((suppressedRule) => {
    const ruleName = diagnosticRuleNameOf(suppressedRule);
    return (
      ruleName === config.inlineSuppressionGuardRuleName ||
      ruleName.endsWith(`/${config.inlineSuppressionGuardRuleName}`)
    );
  });

export const presetNativeSuppressionProblems = ({
  file,
  source,
  config,
}: {
  readonly file: string;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): readonly RepositoryProblem[] =>
  lintDisableDirectivesIn({ sourceName: file, sourceText: source }).flatMap((directive) => {
    if (directive.engine !== "oxlint") return [];
    if (
      directive.suppressedRules.length !== 0 &&
      !directive.suppressedRules.includes("all") &&
      !targetsGuardRule(directive.suppressedRules, config)
    ) {
      return [];
    }
    return [
      {
        file,
        line: directive.line,
        message: `A native Oxlint disable directive must not suppress every rule or ${config.inlineSuppressionGuardRuleName}, because that removes the guard that rejects protected-rule suppressions. Delete the directive and register an allowed deviation in configuration.`,
      },
    ];
  });
