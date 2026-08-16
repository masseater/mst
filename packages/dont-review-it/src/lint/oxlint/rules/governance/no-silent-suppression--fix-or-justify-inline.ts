import { createDontReviewItRule } from "../../../../create-rule.ts";
import { matchesGlobPath } from "../../lib/glob-path-match.ts";
import {
  ignoreEntriesIn,
  LINT_CONFIGURATION_FILE,
  lintBlockOf,
  weakenedTargetRulesIn,
  type IgnoreEntry,
} from "../../lib/lint-suppression/lint-config-suppression.ts";
import {
  coveredRulesOf,
  namesRule,
  suppressionDirectiveOf,
  type SuppressionDirective,
} from "../../lib/lint-suppression/suppression-directives.ts";
import { segmentsOf } from "../../lib/path-segments.ts";
import { toPosixPath } from "../../lib/posix-path.ts";

import type { Comment, ESTree, Options } from "@oxlint/plugins";

const RULE_NAME = "no-silent-suppression--fix-or-justify-inline";

const GUARDED_RULES = [
  "no-duplicate-exported-type--reuse-authoritative-type",
  "no-split-type-authority--rename-or-unify",
  "no-duplicate-value-declaration--reuse-authoritative-value",
  "no-duplicate-line-block--extract-shared-function",
  "no-repeated-call-chain--extract-data-loop",
  "require-catalog-protocol--use-catalog-literal",
  "require-catalog-entry--register-shared-dependency",
  "forbid-target-file--delete-or-relocate",
  RULE_NAME,
];

const EXCLUDED_REGIONS = [".git", "node_modules", "dist", "coverage"];

const EVERY_GUARDED_RULE = "every rule this package enforces";

const STRING_LIST_SCHEMA = { type: "array", items: { type: "string" } } as const;

const spelledListOf = (spelledNames: readonly string[]): string =>
  spelledNames.map((spelled) => `\`${spelled}\``).join(", ");

const configuredListOf = (
  ruleOptions: Readonly<Options>,
  { name, carried }: { readonly name: string; readonly carried: readonly string[] },
): readonly string[] => {
  const [declared] = ruleOptions;
  if (typeof declared !== "object" || declared === null || Array.isArray(declared)) return carried;
  const listed = declared[name];
  if (!Array.isArray(listed)) return carried;
  return listed.filter((candidate): candidate is string => typeof candidate === "string");
};

const namesDeclaredRegion = ({
  pattern,
  excludedRegions,
}: {
  readonly pattern: string;
  readonly excludedRegions: readonly string[];
}): boolean =>
  segmentsOf({ path: pattern, separator: "/" }).some((segment) =>
    excludedRegions.includes(segment),
  );

export const noSilentSuppression = createDontReviewItRule({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every report from the rules that keep one declaration in one place to end in a repair, a registered deviation, or a suppression that carries its grounds, so what the linter stops saying is a decision somebody wrote down",
      relatedGuidelines: [],
    },
    messages: {
      groundlessSuppression:
        "A `{{spelling}}` comment covering {{covered}} must not stand without grounds. Rewrite the code that rule reports, register the deviation in the list that rule keeps, or write after `--` what makes this line an exception.",
      wholeFileSuppression:
        "A `{{spelling}}` comment covering {{covered}} must not reach past the line below it. Rewrite the code that rule reports, register the deviation in the list that rule keeps, or replace this comment with `oxlint-disable-next-line` above the one line, naming the rule and writing its grounds after `--`.",
      selfSuppression:
        "A suppression naming `{{ruleName}}` must not stay in the source. Rewrite the code the covered rule reports, or register the deviation in the list that rule keeps.",
      weakenedRule:
        "A lint configuration must not hold `{{ruleName}}` at `{{severity}}`, a level that leaves a run green. Set it to `error`, rewrite the code that rule reports, or register the deviation in the list that rule keeps.",
      undeclaredIgnoredRegion:
        "An ignore pattern must not name `{{pattern}}`, a place outside the regions this repository excludes from the walk. Delete the pattern and rewrite the code it hides, or declare the region in the definition this configuration receives.",
      ignoredForbiddenPath:
        "An ignore pattern must not cover `{{forbiddenPath}}`, a path registered as forbidden. Delete the pattern, and delete that file or move it to the place its owner names.",
    },
    schema: [
      {
        type: "object",
        properties: {
          guardedRules: STRING_LIST_SCHEMA,
          excludedRegions: STRING_LIST_SCHEMA,
          forbiddenPaths: STRING_LIST_SCHEMA,
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const guardedRules = configuredListOf(inspection.options, {
      name: "guardedRules",
      carried: GUARDED_RULES,
    });
    const excludedRegions = configuredListOf(inspection.options, {
      name: "excludedRegions",
      carried: EXCLUDED_REGIONS,
    });
    const forbiddenPaths = configuredListOf(inspection.options, {
      name: "forbiddenPaths",
      carried: [],
    });

    const reportCoverage = ({
      comment,
      directive,
    }: {
      readonly comment: Comment;
      readonly directive: SuppressionDirective;
    }): void => {
      const covered = coveredRulesOf({ directive, targetRules: guardedRules });
      if (covered.length === 0) return;
      const coverage = {
        spelling: directive.spelling,
        covered: directive.ruleNames.length === 0 ? EVERY_GUARDED_RULE : spelledListOf(covered),
      };
      if (directive.coversWholeFile) {
        inspection.report({ loc: comment.loc, messageId: "wholeFileSuppression", data: coverage });
        return;
      }
      if (directive.carriesGrounds) return;
      inspection.report({ loc: comment.loc, messageId: "groundlessSuppression", data: coverage });
    };

    const reportComment = (comment: Comment): void => {
      const directive = suppressionDirectiveOf(comment);
      if (directive === null) return;
      if (!namesRule({ directive, ruleName: RULE_NAME })) {
        reportCoverage({ comment, directive });
        return;
      }
      inspection.report({
        loc: comment.loc,
        messageId: "selfSuppression",
        data: { ruleName: RULE_NAME },
      });
    };

    const hiddenForbiddenPathOf = (pattern: string): string | undefined =>
      forbiddenPaths.find((forbiddenPath) =>
        matchesGlobPath({
          pathSegments: segmentsOf({ path: toPosixPath(forbiddenPath), separator: "/" }),
          pattern,
          cwd: inspection.cwd,
        }),
      );

    const reportIgnoreEntry = (listed: IgnoreEntry): void => {
      const hidden = hiddenForbiddenPathOf(listed.pattern);
      if (hidden !== undefined) {
        inspection.report({
          node: listed.element,
          messageId: "ignoredForbiddenPath",
          data: { forbiddenPath: hidden },
        });
        return;
      }
      if (namesDeclaredRegion({ pattern: listed.pattern, excludedRegions })) return;
      inspection.report({
        node: listed.element,
        messageId: "undeclaredIgnoredRegion",
        data: { pattern: listed.pattern },
      });
    };

    const reportConfiguration = (program: ESTree.Program): void => {
      const lint = lintBlockOf(program);
      if (lint === null) return;
      for (const weakened of weakenedTargetRulesIn({ lint, targetRules: guardedRules })) {
        inspection.report({
          node: weakened.property,
          messageId: "weakenedRule",
          data: { ruleName: weakened.ruleName, severity: weakened.severity },
        });
      }
      for (const listed of ignoreEntriesIn(lint)) reportIgnoreEntry(listed);
    };

    return {
      Program(node: ESTree.Program) {
        for (const comment of node.comments) reportComment(comment);
        if (!LINT_CONFIGURATION_FILE.test(toPosixPath(inspection.filename))) return;
        reportConfiguration(node);
      },
    };
  },
});
