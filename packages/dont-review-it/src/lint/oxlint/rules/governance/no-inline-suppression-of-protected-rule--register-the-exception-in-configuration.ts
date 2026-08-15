import { relative, resolve } from "node:path";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { ancestorsOf } from "../../lib/ast-node.ts";
import { matchesAnchoredGlobPath } from "../../lib/glob-path-match.ts";
import {
  LINT_CONFIGURATION_FILE,
  lintBlockOf,
  weakenedTargetRulesIn,
  type WeakenedRule,
} from "../../lib/lint-suppression/lint-config-suppression.ts";
import {
  GENERATED_PATHS,
  protectedRulesFrom,
  protectionSettingsIn,
  PROTECTION_SCHEMA,
  type ProtectionDeviation,
} from "../../lib/lint-suppression/protected-rules.ts";
import {
  bareRuleNameOf,
  coveredRulesOf,
  suppressionDirectiveOf,
} from "../../lib/lint-suppression/suppression-directives.ts";
import { objectValueOf } from "../../lib/object-literal.ts";
import { toPosixPath } from "../../lib/posix-path.ts";

import type { Comment, ESTree } from "@oxlint/plugins";
import type { RuleMessage } from "../../lib/rule-message.ts";

const scopedPathsOf = (property: ESTree.ObjectProperty): readonly (string | null)[] | null => {
  const scope = ancestorsOf(property).findLast(
    (node): node is ESTree.ObjectExpression =>
      node.type === "ObjectExpression" && objectValueOf({ object: node, key: "files" }) !== null,
  );
  if (scope === undefined) return null;
  const files = objectValueOf({ object: scope, key: "files" });
  if (files?.type !== "ArrayExpression") return [];
  return files.elements.map((held) =>
    held?.type === "Literal" && typeof held.value === "string" ? held.value : null,
  );
};

const PATTERN_MARKER = /[*?[\]{}]/u;

const listsCompletePaths = (paths: readonly (string | null)[]): boolean =>
  paths.length > 0 && paths.every((path) => path !== null && !PATTERN_MARKER.test(path));

const patternAmong = (paths: readonly (string | null)[]): string | undefined =>
  paths.filter((path) => path !== null).find((path) => PATTERN_MARKER.test(path));

const weakeningMessageFor = (weakened: WeakenedRule): RuleMessage | null => {
  const carried = { ruleName: weakened.ruleName, severity: weakened.severity };
  const paths = scopedPathsOf(weakened.property);
  if (paths === null) return { messageId: "weakenedProtectedRule", data: carried };
  if (listsCompletePaths(paths)) return null;
  const pattern = patternAmong(paths);
  if (pattern === undefined) return { messageId: "weakenedProtectedRule", data: carried };
  return { messageId: "patternScopedException", data: { ...carried, pattern } };
};

const RULE_NAME =
  "no-inline-suppression-of-protected-rule--register-the-exception-in-configuration";

const deviationMessageFor = (deviation: ProtectionDeviation): RuleMessage | null => {
  const carried = { ruleName: deviation.rule };
  if (bareRuleNameOf(deviation.rule) === RULE_NAME) {
    return { messageId: "selfDeviation", data: carried };
  }
  return deviation.grounds === "" ? { messageId: "groundlessDeviation", data: carried } : null;
};

export const noInlineSuppressionOfProtectedRule = createDontReviewItRule({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow silencing a protected rule from a comment in the source or from a severity the lint configuration lowers, so an exception to one of these rules stands as one registered entry carrying the grounds somebody wrote for it",
      relatedGuidelines: [],
    },
    messages: {
      namedSuppression:
        "A `{{spelling}}` comment must not name `{{ruleName}}`, a rule this package protects. Rewrite the code that rule reports, or register the exception in the lint configuration together with the grounds for it.",
      blanketSuppression:
        "A `{{spelling}}` comment that names no rule covers every rule this package protects, and must not stand in the source. Rewrite the code those rules report, or register the exception in the lint configuration together with the grounds for it.",
      weakenedProtectedRule:
        "A lint configuration must not hold `{{ruleName}}`, a rule this package protects, at `{{severity}}`. Set it to `error`, or move the exception into an override that lists the complete path of every file it covers together with the grounds for it.",
      patternScopedException:
        "An override holding `{{ruleName}}` at `{{severity}}` must not take its scope from the pattern `{{pattern}}`. Replace that pattern with the complete path of every file this exception covers.",
      groundlessDeviation:
        "A deviation must not take `{{ruleName}}` out of the protected list without grounds. Write into that entry what makes the rule an exception, or delete the entry.",
      selfDeviation:
        "A deviation must not take `{{ruleName}}` out of the protected list. Delete that entry and rewrite the code this rule reports.",
    },
    schema: [PROTECTION_SCHEMA],
  },
  create(inspection) {
    const settings = protectionSettingsIn(inspection.options);
    const protectedRules = protectedRulesFrom({ settings, keptRule: RULE_NAME });
    const relativePath = toPosixPath(
      relative(inspection.cwd, resolve(inspection.cwd, inspection.filename)),
    );
    const generated = [...GENERATED_PATHS, ...settings.generatedPaths].some((pattern) =>
      matchesAnchoredGlobPath({ relativePath, pattern }),
    );

    const reportComment = (comment: Comment): void => {
      const directive = suppressionDirectiveOf(comment, settings.suppressionSpellings);
      if (directive === null) return;
      const covered = coveredRulesOf({ directive, targetRules: protectedRules });
      if (covered.length === 0) return;
      const spelling = { spelling: directive.spelling };
      if (directive.ruleNames.length === 0) {
        inspection.report({ loc: comment.loc, messageId: "blanketSuppression", data: spelling });
        return;
      }
      for (const ruleName of covered) {
        inspection.report({
          loc: comment.loc,
          messageId: "namedSuppression",
          data: { ...spelling, ruleName },
        });
      }
    };

    const reportConfiguration = (program: ESTree.Program): void => {
      for (const deviation of settings.deviations) {
        const complaint = deviationMessageFor(deviation);
        if (complaint !== null) inspection.report({ node: program, ...complaint });
      }
      const lint = lintBlockOf(program);
      if (lint === null) return;
      for (const weakened of weakenedTargetRulesIn({ lint, targetRules: protectedRules })) {
        const complaint = weakeningMessageFor(weakened);
        if (complaint !== null) inspection.report({ node: weakened.property, ...complaint });
      }
    };

    return {
      Program(node: ESTree.Program) {
        if (generated) return;
        for (const comment of node.comments) reportComment(comment);
        if (!LINT_CONFIGURATION_FILE.test(toPosixPath(inspection.filename))) return;
        reportConfiguration(node);
      },
    };
  },
});
