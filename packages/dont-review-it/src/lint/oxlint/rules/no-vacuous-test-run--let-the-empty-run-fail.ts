import { createDontReviewItRule } from "../../../create-rule.ts";
import { defaultExportedObject } from "../lib/default-exported-object.ts";
import { objectPropertyOf, objectValueOf } from "../lib/object-literal.ts";
import { isTestRunnerConfig } from "../lib/test-runner-config.ts";

import type { ESTree } from "@oxlint/plugins";

const messageIdFor = ({ value }: ESTree.ObjectProperty): string | null => {
  if (value.type !== "Literal") return "unsettledEmptyRunOutcome";
  if (value.value === true) return "vacuousTestRun";
  return value.value === false ? null : "unsettledEmptyRunOutcome";
};

export const noVacuousTestRun = createDontReviewItRule({
  name: "no-vacuous-test-run--let-the-empty-run-fail",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a test config that lets a run finding no test file report success, so a suite that stopped being collected reaches the gate as a failure instead of as a green run",
      relatedGuidelines: [],
    },
    messages: {
      vacuousTestRun:
        "A test config must not let a run that found no test file report success. Delete `passWithNoTests` from the test config.",
      unsettledEmptyRunOutcome:
        "A test config must not spell `passWithNoTests` as a value other than `false`. Delete `passWithNoTests` from the test config.",
    },
    schema: [],
  },
  create(inspection) {
    if (!isTestRunnerConfig(inspection.filename)) return {};

    return {
      Program(node: ESTree.Program) {
        const config = defaultExportedObject(node);
        const test = config === null ? null : objectValueOf({ object: config, key: "test" });
        if (test?.type !== "ObjectExpression") return;
        const declared = objectPropertyOf({ object: test, key: "passWithNoTests" });
        if (declared === null) return;
        const messageId = messageIdFor(declared);
        if (messageId === null) return;
        inspection.report({ node: declared, messageId });
      },
    };
  },
});
