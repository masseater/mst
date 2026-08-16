import { basename } from "node:path";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { OUT_OF_SCOPE_FILE_NAME } from "../../lib/out-of-scope-source.ts";

import type { ESTree } from "@oxlint/plugins";

const SANCTIONED_TEST_FILE_NAME = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;

const isTestAdjacentFileName = (fileName: string): boolean =>
  OUT_OF_SCOPE_FILE_NAME.test(fileName) && !SANCTIONED_TEST_FILE_NAME.test(fileName);

export const forbidTestAdjacentFile = createDontReviewItRule({
  name: "forbid-test-adjacent-file--inline-its-setup-into-the-test",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a file whose name carries a test marker other than the two the repository runs, so no file can leave the production scope by the way it is spelled",
      relatedGuidelines: [],
    },
    messages: {
      testAdjacentFile:
        "A file name must not carry a test marker other than `.test.` or `.spec.`. Delete `{{fileName}}` and declare what it holds inside each test that uses it.",
    },
    schema: [],
  },
  create(inspection) {
    const fileName = basename(inspection.filename);
    if (!isTestAdjacentFileName(fileName)) return {};

    return {
      Program(node: ESTree.Program) {
        inspection.report({ node, messageId: "testAdjacentFile", data: { fileName } });
      },
    };
  },
});
