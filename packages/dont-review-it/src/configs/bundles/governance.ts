import { forbidDeclaredCommandInvocation } from "../../lint/oxlint/rules/governance/forbid-declared-command-invocation--use-designated-replacement.ts";
import { forbidGenericRestrictionRule } from "../../lint/oxlint/rules/governance/forbid-generic-restriction-rule--use-the-declared-rule.ts";
import { forbidRestrictedTargetRelay } from "../../lint/oxlint/rules/governance/forbid-restricted-target-relay--delete-the-relay.ts";
import { noBlanketSuppression } from "../../lint/oxlint/rules/governance/no-blanket-suppression--name-and-record.ts";
import { noInlineSuppressionOfProtectedRule } from "../../lint/oxlint/rules/governance/no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.ts";
import { noPartialRuleSet } from "../../lint/oxlint/rules/governance/no-partial-rule-set--enable-the-whole-set.ts";
import { noRuleSuppression } from "../../lint/oxlint/rules/governance/no-rule-suppression--fix-the-violation.ts";
import { noSilentSuppression } from "../../lint/oxlint/rules/governance/no-silent-suppression--fix-or-justify-inline.ts";
import { noUnregisteredRulePlugin } from "../../lint/oxlint/rules/governance/no-unregistered-rule-plugin--enable-the-plugin.ts";
import { noUnwrappedToolchainConfig } from "../../lint/oxlint/rules/governance/no-unwrapped-toolchain-config--call-the-preset-for-the-block.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";

export const governanceBundle: readonly WorkspaceLintRule[] = [
  forbidDeclaredCommandInvocation,
  forbidGenericRestrictionRule,
  forbidRestrictedTargetRelay,
  noBlanketSuppression,
  noInlineSuppressionOfProtectedRule,
  noPartialRuleSet,
  noRuleSuppression,
  noSilentSuppression,
  noUnregisteredRulePlugin,
  noUnwrappedToolchainConfig,
];
