import { createDontReviewItRule } from "../../../../create-rule.ts";
import { repeatedTestCasesIn } from "../../lib/duplicated-tests/test-cases.ts";

import type { ESTree } from "@oxlint/plugins";

export const noDuplicatedTest = createDontReviewItRule({
  name: "no-duplicated-test--delete-the-copy",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a test that another test in the same file spells with the same title and the same body, so one behaviour keeps one place that pins it",
      relatedGuidelines: ["docs/guidelines/tests.md"],
    },
    messages: {
      duplicatedTest:
        "A test must not carry both the title and the body of another test in this file. Delete the `{{title}}` that starts on line {{line}}.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      Program(node: ESTree.Program) {
        for (const testCase of repeatedTestCasesIn(inspection.sourceCode.text)) {
          inspection.report({
            node,
            messageId: "duplicatedTest",
            data: { title: testCase.name, line: String(testCase.line) },
          });
        }
      },
    };
  },
});
