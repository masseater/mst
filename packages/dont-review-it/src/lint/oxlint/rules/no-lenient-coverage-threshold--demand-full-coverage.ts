import { createDontReviewItRule } from "../../../create-rule.ts";
import { defaultExportedObject } from "../lib/default-exported-object.ts";
import { nestedObjectAt, objectPropertyOf, objectValueOf } from "../lib/object-literal.ts";
import { withoutParentheses } from "../lib/parenthesized-expression.ts";
import { segmentsOf } from "../lib/path-segments.ts";
import { toPosixPath } from "../lib/posix-path.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const TEST_CONFIG_FILE_NAME = /^vite(?:st)?\.config\.[cm]?[jt]s$/u;

const THRESHOLDS_PATH = ["test", "coverage", "thresholds"];

const FULL_COVERAGE = 100;

const COVERAGE_METRICS = ["branches", "functions", "lines", "statements"];

const THRESHOLD_SCHEMA = { type: "number", minimum: 0, maximum: FULL_COVERAGE } as const;

type CoverageRequirement = {
  readonly metric: string;
  readonly required: number;
};

type CoverageViolation = {
  readonly node: ESTree.ObjectExpression | ESTree.ObjectProperty;
  readonly messageId: string;
  readonly data: Record<string, number | string>;
};

const fileNameOf = (path: string): string =>
  segmentsOf({ path: toPosixPath(path), separator: "/" }).at(-1) ?? "";

const requirementsFrom = (options: Readonly<Options>): readonly CoverageRequirement[] => {
  const [first] = options;
  const overrides =
    typeof first === "object" && first !== null && !Array.isArray(first) ? first : {};
  return COVERAGE_METRICS.map((metric) => {
    const override = overrides[metric];
    return { metric, required: typeof override === "number" ? override : FULL_COVERAGE };
  });
};

const requirementSummaryOf = (requirements: readonly CoverageRequirement[]): string =>
  requirements.map(({ metric, required }) => `\`${metric}\` to ${required}`).join(", ");

const declaredNumberOf = (expression: ESTree.Expression): number | null => {
  const literal = withoutParentheses(expression);
  return literal.type === "Literal" && typeof literal.value === "number" ? literal.value : null;
};

const demandsFullCoverage = (thresholds: ESTree.ObjectExpression): boolean => {
  const shorthand = objectValueOf({ object: thresholds, key: String(FULL_COVERAGE) });
  return shorthand !== null && shorthand.type === "Literal" && shorthand.value === true;
};

const violationsIn = ({
  thresholds,
  requirements,
}: {
  readonly thresholds: ESTree.ObjectExpression;
  readonly requirements: readonly CoverageRequirement[];
}): readonly CoverageViolation[] => {
  const shorthandDemandsFullCoverage = demandsFullCoverage(thresholds);
  return requirements.flatMap<CoverageViolation>(({ metric, required }) => {
    if (shorthandDemandsFullCoverage && required <= FULL_COVERAGE) return [];
    const property = objectPropertyOf({ object: thresholds, key: metric });
    const unset = { messageId: "unsetCoverageThreshold", data: { metric, required } };
    if (property === null) return [{ node: thresholds, ...unset }];
    const declared = declaredNumberOf(property.value);
    if (declared === null) return [{ node: property, ...unset }];
    return declared >= required
      ? []
      : [
          {
            node: property,
            messageId: "lenientCoverageThreshold",
            data: { metric, required, declared },
          },
        ];
  });
};

export const noLenientCoverageThreshold = createDontReviewItRule({
  name: "no-lenient-coverage-threshold--demand-full-coverage",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the test config to demand full coverage on every metric, so the amount of untested code that is allowed to stay is a decision written down once rather than whatever the suite happens to reach",
      relatedGuidelines: [],
    },
    messages: {
      missingCoverageThresholds:
        "A test config must demand a coverage number, because a suite that measures coverage without demanding a number lets it fall commit by commit and nothing ever turns red. `{{path}}` is absent from this config. Add it and set {{requirement}}, or write `100: true` to demand full coverage on every metric at once. If a metric genuinely cannot reach the required number, lower that one metric in this rule's options so the exemption is decided once for every config, instead of leaving the whole config silent.",
      unsetCoverageThreshold:
        "Every coverage metric must carry a threshold, because a metric left out is a metric nobody is watching, and the ones nobody watches are the ones that erode first. `{{metric}}` carries no number in `test.coverage.thresholds`. Set it to {{required}}, or write `100: true` to demand full coverage on every metric at once. A value that is not a plain number cannot be read here, so a computed or imported threshold counts as absent.",
      lenientCoverageThreshold:
        "A coverage threshold must not sit below what this repository demands, because a threshold below the demanded number names an amount of untested code that is allowed to stay, and that amount never falls back on its own. `{{metric}}` is declared as {{declared}} against a demanded {{required}}. Raise it to {{required}} and cover the code that made you lower it. If the demand itself is wrong for this repository, change it in this rule's options so it is decided once for every config rather than drifting config by config.",
    },
    schema: [
      {
        type: "object",
        properties: {
          branches: THRESHOLD_SCHEMA,
          functions: THRESHOLD_SCHEMA,
          lines: THRESHOLD_SCHEMA,
          statements: THRESHOLD_SCHEMA,
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (!TEST_CONFIG_FILE_NAME.test(fileNameOf(context.filename))) return {};
    const requirements = requirementsFrom(context.options);

    return {
      Program(node: ESTree.Program) {
        const config = defaultExportedObject(node);
        const thresholds =
          config === null ? null : nestedObjectAt({ object: config, path: THRESHOLDS_PATH });
        if (thresholds === null) {
          context.report({
            node,
            messageId: "missingCoverageThresholds",
            data: {
              path: THRESHOLDS_PATH.join("."),
              requirement: requirementSummaryOf(requirements),
            },
          });
          return;
        }
        for (const violation of violationsIn({ thresholds, requirements })) {
          context.report(violation);
        }
      },
    };
  },
});
