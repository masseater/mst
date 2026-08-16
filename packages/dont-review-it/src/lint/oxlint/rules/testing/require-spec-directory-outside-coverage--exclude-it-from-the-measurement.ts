import { createDontReviewItRule } from "../../../../create-rule.ts";
import { defaultExportedObject } from "../../lib/default-exported-object.ts";
import { nestedObjectAt, objectValueOf } from "../../lib/object-literal.ts";
import { isRecord } from "../../lib/record-value.ts";
import { isTestRunnerConfig } from "../../lib/test-runner-config.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const COVERAGE_PATH = ["test", "coverage"];

const EXCLUDE_KEY = "exclude";

const DEFAULT_PATTERN = "specs/**";

const requiredPatternFrom = (ruleOptions: Readonly<Options>): string => {
  const [first] = ruleOptions;
  const declared = isRecord(first) ? first.pattern : undefined;
  return typeof declared === "string" ? declared : DEFAULT_PATTERN;
};

const spelledEntriesIn = (held: ESTree.Expression | null): readonly string[] => {
  if (held?.type !== "ArrayExpression") return [];
  return held.elements.flatMap((listed) =>
    listed?.type === "Literal" && typeof listed.value === "string" ? [listed.value] : [],
  );
};

export const requireSpecDirectoryOutsideCoverage = createDontReviewItRule({
  name: "require-spec-directory-outside-coverage--exclude-it-from-the-measurement",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the test config to keep the specification directory out of the coverage measurement, so the number a run reports is what the tests beside the sources reached rather than what the specifications happened to touch",
      relatedGuidelines: [],
    },
    messages: {
      unmeasuredCoverageExclusion:
        "A test config that measures coverage must not go without `test.coverage.exclude`. Add it and put `{{pattern}}` in it, then secure coverage with tests beside the sources.",
      includedSpecDirectory:
        "The specification directory must not count toward the coverage measurement. `{{pattern}}` is absent from `test.coverage.exclude`. Add it, and cover the code from tests beside the sources instead.",
    },
    schema: [
      {
        type: "object",
        properties: { pattern: { type: "string" } },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isTestRunnerConfig(inspection.filename)) return {};
    const pattern = requiredPatternFrom(inspection.options);

    return {
      Program(node: ESTree.Program) {
        const config = defaultExportedObject(node);
        const coverage =
          config === null ? null : nestedObjectAt({ object: config, path: COVERAGE_PATH });
        if (coverage === null) return;

        const excluded = objectValueOf({ object: coverage, key: EXCLUDE_KEY });
        if (excluded === null) {
          inspection.report({
            node: coverage,
            messageId: "unmeasuredCoverageExclusion",
            data: { pattern },
          });
          return;
        }
        if (!spelledEntriesIn(excluded).includes(pattern)) {
          inspection.report({
            node: excluded,
            messageId: "includedSpecDirectory",
            data: { pattern },
          });
        }
      },
    };
  },
});
