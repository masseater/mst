import { createDontReviewItRule } from "../../../create-rule.ts";
import { objectPropertyOf, objectValueOf } from "../lib/object-literal.ts";
import {
  resolveTestConfig,
  staticallyClosedObject,
  staticObjectPathAt,
  type StaticObjectResolution,
  type TestConfigResolution,
} from "../lib/static-test-config.ts";
import { unwrapTransparentExpression } from "../lib/transparent-expression.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const THRESHOLDS_PATH = ["test", "coverage", "thresholds"];

const FULL_COVERAGE = 100;

const COVERAGE_METRICS = ["branches", "functions", "lines", "statements"];

const PER_FILE_KEY = "perFile";

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

const isRecord = (held: unknown): held is Readonly<Record<string, unknown>> =>
  held instanceof Object;

const requirementsFrom = (ruleOptions: Readonly<Options>): readonly CoverageRequirement[] => {
  const [first] = ruleOptions;
  const overrides = isRecord(first) ? first : {};
  return COVERAGE_METRICS.map((metric) => {
    const override = overrides[metric];
    return { metric, required: typeof override === "number" ? override : FULL_COVERAGE };
  });
};

const requirementSummaryOf = (requirements: readonly CoverageRequirement[]): string =>
  requirements.map(({ metric, required }) => `\`${metric}\` to ${required}`).join(", ");

const declaredNumberOf = (literal: ESTree.Expression): number | null => {
  const declared = unwrapTransparentExpression(literal);
  return declared.type === "Literal" && typeof declared.value === "number" ? declared.value : null;
};

const declaresTrueAt = ({
  thresholds,
  key,
}: {
  readonly thresholds: ESTree.ObjectExpression;
  readonly key: string;
}): boolean => {
  const declared = objectValueOf({ object: thresholds, key });
  if (declared === null) return false;
  const unwrapped = unwrapTransparentExpression(declared);
  return unwrapped.type === "Literal" && unwrapped.value === true;
};

const violationsIn = ({
  thresholds,
  requirements,
}: {
  readonly thresholds: ESTree.ObjectExpression;
  readonly requirements: readonly CoverageRequirement[];
}): readonly CoverageViolation[] => {
  const shorthandDemandsFullCoverage = declaresTrueAt({
    thresholds,
    key: String(FULL_COVERAGE),
  });
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
        "A test config must not measure coverage without demanding a number. `{{path}}` is absent from this config. Add it and set {{requirement}} together with `perFile: true`.",
      aggregateCoverageThreshold:
        "A coverage threshold must not be checked against the package total. `perFile` is not set to `true` in `test.coverage.thresholds`. Add it.",
      unsetCoverageThreshold:
        "A coverage metric must not be left without a threshold. `{{metric}}` carries no number in `test.coverage.thresholds`. Set it to {{required}}.",
      lenientCoverageThreshold:
        "A coverage threshold must not sit below what this repository demands. `{{metric}}` is declared as {{declared}} against a demanded {{required}}. Raise it to {{required}} and cover the code that made you lower it.",
      dynamicCoverageConfiguration:
        "Coverage thresholds must not be assembled from merge calls, variables, spreads, or computed properties. Export one static `defineConfig({...})` object and write `test.coverage.thresholds` as one object literal.",
      commonJsTestConfig:
        "A CommonJS test config must not sit outside the static coverage guards. Rename this file to `vite.config.ts` or `vitest.config.ts`, import `defineConfig` from Vite, Vite Plus, or `vitest/config`, and export one ESM `defineConfig({...})` object as the default.",
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
  create(inspection) {
    const requirements = requirementsFrom(inspection.options);

    const reportMissingThresholds = (node: ESTree.Program): void => {
      inspection.report({
        node,
        messageId: "missingCoverageThresholds",
        data: {
          path: THRESHOLDS_PATH.join("."),
          requirement: requirementSummaryOf(requirements),
        },
      });
    };

    const inspectThresholds = (thresholds: StaticObjectResolution, node: ESTree.Program): void => {
      if (thresholds.kind === "dynamic") {
        inspection.report({ node, messageId: "dynamicCoverageConfiguration" });
        return;
      }
      if (thresholds.kind === "missing") {
        reportMissingThresholds(node);
        return;
      }
      if (!declaresTrueAt({ thresholds: thresholds.object, key: PER_FILE_KEY })) {
        inspection.report({ node: thresholds.object, messageId: "aggregateCoverageThreshold" });
      }
      for (const violation of violationsIn({
        thresholds: thresholds.object,
        requirements,
      })) {
        inspection.report(violation);
      }
    };

    const inspectResolvedConfig = (resolved: TestConfigResolution, node: ESTree.Program): void => {
      if (resolved.kind === "not-test-config") return;
      if (resolved.kind === "commonjs") {
        inspection.report({ node, messageId: "commonJsTestConfig" });
        return;
      }
      if (resolved.kind === "dynamic") {
        inspection.report({ node, messageId: "dynamicCoverageConfiguration" });
        return;
      }
      inspectThresholds(
        staticallyClosedObject(
          staticObjectPathAt({ object: resolved.config, path: THRESHOLDS_PATH }),
        ),
        node,
      );
    };

    return {
      Program(node: ESTree.Program) {
        inspectResolvedConfig(
          resolveTestConfig({ filename: inspection.filename, program: node }),
          node,
        );
      },
    };
  },
});
