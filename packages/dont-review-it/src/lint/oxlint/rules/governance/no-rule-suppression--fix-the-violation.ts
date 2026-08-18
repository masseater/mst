import { dirname, resolve } from "node:path";

import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { uniq } from "es-toolkit";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import { spelledNames } from "../../lib/declared-coverage/coverage-declarations.ts";
import {
  LINT_CONFIGURATION_FILE,
  lintBlockOf,
} from "../../lib/lint-suppression/lint-config-suppression.ts";
import {
  bareRuleNameOf,
  coveredRulesOf,
  suppressionDirectiveOf,
  type SuppressionDirective,
} from "../../lib/lint-suppression/suppression-directives.ts";
import { objectPropertyOf, propertyKeyOf } from "../../lib/object-literal.ts";
import { toPosixPath } from "../../lib/posix-path.ts";
import { ruleBlockObjectOf } from "../../lib/rule-sets/configured-rule-blocks.ts";
import { severityLevelOf } from "../../lib/rule-sets/severity-levels.ts";
import {
  ignoredSpecFilesIn,
  scopeSpellingOf,
} from "../../lib/spec-lint-coverage/configured-scope.ts";
import { DEFAULT_SPEC_FILE_SUFFIXES, isSpecFile } from "../../lib/spec-syntax/spec-files.ts";

import type { Comment, ESTree, Options } from "@oxlint/plugins";

const SILENCED_LEVELS: ReadonlySet<string> = new Set([LINT_SEVERITY.OFF, LINT_SEVERITY.WARN]);

const DIRECTIVE_RESPECT_KEY = "respectEslintDisableDirectives";

const GATE_SCHEMA = {
  type: "object",
  properties: { targetRules: { type: "array", items: { type: "string" } } },
  additionalProperties: false,
} as const;

const RULE_NAME = "no-rule-suppression--fix-the-violation";

const DETERMINISM_GATE_RULES: readonly string[] = [
  "no-module-scope-mock-config--lift-into-fixture",
  "no-module-scope-mutable-state--lift-into-fixture",
  "no-vi-mock-factory-behavior--use-spy-true-and-fixture",
  "no-redundant-mock-reset--lift-mocks-into-fixture",
  "no-local-file-system-mock--use-shared-fs",
  "no-fixture-ordering-alias--use-auto-action-fixture",
  "no-spec-specific-shared-setup--keep-setup-uniform",
  RULE_NAME,
];

const targetRulesFrom = (ruleOptions: Readonly<Options>): readonly string[] => {
  const [declared] = ruleOptions;
  if (typeof declared !== "object" || declared === null || Array.isArray(declared)) {
    return DETERMINISM_GATE_RULES;
  }
  const listed = declared.targetRules;
  const added = Array.isArray(listed)
    ? listed.filter((spelled): spelled is string => typeof spelled === "string")
    : [];
  return uniq([...DETERMINISM_GATE_RULES, ...added]);
};

const RANGE_REOPENING_SPELLINGS: readonly string[] = ["eslint-enable", "oxlint-enable"];

const messageIdFor = (directive: SuppressionDirective): string => {
  if (RANGE_REOPENING_SPELLINGS.includes(directive.spelling)) return "suppressionRangeEnd";
  return directive.coversWholeFile ? "fileScopedSuppression" : "lineScopedSuppression";
};

const EVERY_RULE_REACHING_HERE = "every rule reaching this file (this gate among them)";

const silencedSpellingOf = ({
  directive,
  covered,
}: {
  readonly directive: SuppressionDirective;
  readonly covered: readonly string[];
}): string => (directive.ruleNames.length === 0 ? EVERY_RULE_REACHING_HERE : spelledNames(covered));

export const noRuleSuppression = createDontReviewItRule({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow taking a rule of the parallel determinism gate out of a run through a suppression comment, a lowered severity, or an ignore entry, leaving the code the rule stands on as the only place a report ends",
      relatedGuidelines: ["docs/guidelines/enforcement.md"],
    },
    messages: {
      fileScopedSuppression:
        "A `{{spelling}}` comment must not stand over a file this gate reads. It takes {{silenced}} out of the run for every line of the file, and the invariants those rules carry go unchecked here. Delete the comment, then rewrite the code the reopened reports stand on. Rewrite the definition of a rule to change the discipline it carries.",
      lineScopedSuppression:
        "A `{{spelling}}` comment must not stand in a file this gate reads. It takes {{silenced}} out of the run at the line it covers, and the invariants those rules carry go unchecked there. Delete the comment, then rewrite the code the reopened report stands on. Rewrite the definition of a rule to change the discipline it carries.",
      suppressionRangeEnd:
        "A `{{spelling}}` comment must not stand in a file this gate reads. It closes a range that takes {{silenced}} out of the run, and the invariants those rules carry go unchecked across that range. Delete both ends of the range, then rewrite the code the reopened reports stand on. Rewrite the definition of a rule to change the discipline it carries.",
      weakenedRule:
        "A lint configuration must not hold `{{ruleName}}`, a rule of the parallel determinism gate, at `{{severity}}`. This entry takes the rule out of every run, and the invariant it carries goes unchecked across the whole tree. Set this entry to `error`, then rewrite the code the rule reports.",
      scopedWeakenedRule:
        "An override must not hold `{{ruleName}}`, a rule of the parallel determinism gate, at `{{severity}}` over {{scope}}. Those paths keep the code the rule reports and lose the report itself. Delete this entry, then rewrite the code the rule reports over those paths.",
      unreadableSeverity:
        "A severity this rule cannot read must not stand on `{{ruleName}}`, a rule of the parallel determinism gate. A value assembled elsewhere hides the level this gate runs at. Write the severity of this entry as the literal `error`.",
      respectedDisableDirectives:
        "A lint configuration must not hand the suppression comments of a run back their force. Every comment naming a rule of the parallel determinism gate starts taking that rule out of the run again. Set this entry to `false`, then delete the comments it was standing for.",
      ignoredSpecFile:
        "An ignore entry must not cover a file this gate reads. `{{pattern}}` covers `{{matchedPath}}`, an authored spec file, and every rule of the gate stops reporting over it. Narrow that pattern to the generated paths it stands for, or delete it and rewrite the code the gate reports.",
    },
    schema: [GATE_SCHEMA],
  },
  create(inspection) {
    const targetRules = targetRulesFrom(inspection.options);
    const named = new Set(targetRules.map(bareRuleNameOf));
    const posixFilename = toPosixPath(inspection.filename);
    const configurationFile = LINT_CONFIGURATION_FILE.test(posixFilename);
    const gateReadsThisFile =
      configurationFile || isSpecFile(posixFilename, DEFAULT_SPEC_FILE_SUFFIXES);

    const reportComment = (comment: Comment): void => {
      const directive = suppressionDirectiveOf(comment, RANGE_REOPENING_SPELLINGS);
      if (directive === null) return;
      const covered = coveredRulesOf({ directive, targetRules });
      if (covered.length === 0) return;
      if (directive.ruleNames.length === 0 && !gateReadsThisFile) return;
      inspection.report({
        loc: comment.loc,
        messageId: messageIdFor(directive),
        data: {
          spelling: directive.spelling,
          silenced: silencedSpellingOf({ directive, covered }),
        },
      });
    };

    const reportEntry = (property: ESTree.ObjectProperty): void => {
      const ruleName = propertyKeyOf(property);
      if (ruleName === null || !named.has(bareRuleNameOf(ruleName))) return;
      const severity = severityLevelOf(property.value);
      if (severity === null) {
        inspection.report({ node: property, messageId: "unreadableSeverity", data: { ruleName } });
        return;
      }
      if (!SILENCED_LEVELS.has(severity)) return;
      const scope = scopeSpellingOf(property);
      const carried = { ruleName, severity };
      inspection.report({
        node: property,
        messageId: scope === null ? "weakenedRule" : "scopedWeakenedRule",
        data: scope === null ? carried : { ...carried, scope },
      });
    };

    const reportIgnoredSpecFiles = (program: ESTree.Program): void => {
      const lint = lintBlockOf(program);
      if (lint === null) return;
      const repositoryRoot = findWorkspaceRoot(
        dirname(resolve(inspection.cwd, inspection.filename)),
      );
      for (const ignored of ignoredSpecFilesIn({ lint, repositoryRoot })) {
        inspection.report({
          node: ignored.entry.element,
          messageId: "ignoredSpecFile",
          data: { pattern: ignored.entry.pattern, matchedPath: ignored.matchedPath },
        });
      }
    };

    return {
      ObjectExpression(node: ESTree.ObjectExpression) {
        const respected = objectPropertyOf({ object: node, key: DIRECTIVE_RESPECT_KEY });
        if (respected?.value.type === "Literal" && respected.value.value === true) {
          inspection.report({ node: respected, messageId: "respectedDisableDirectives" });
        }
        const rules = ruleBlockObjectOf(node);
        if (rules === null) return;
        for (const property of rules.properties) {
          if (property.type === "Property") reportEntry(property);
        }
      },
      "Program:exit"(node: ESTree.Program) {
        for (const comment of node.comments) reportComment(comment);
        if (configurationFile) reportIgnoredSpecFiles(node);
      },
    };
  },
});
