import { existsSync } from "node:fs";

import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const TEST_FILE_NAME = /\.test\.(tsx?)$/u;

const sourcePathFor = (testFilePath: string): string | null => {
  const match = TEST_FILE_NAME.exec(testFilePath);
  return match === null ? null : `${testFilePath.slice(0, match.index)}.${match[1]}`;
};

const existenceByPath = new Map<string, boolean>();

const pathExists = (path: string): boolean => {
  const remembered = existenceByPath.get(path);
  if (remembered !== undefined) return remembered;
  const present = existsSync(path);
  existenceByPath.set(path, present);
  return present;
};

export const noDetachedTestFile = createDontReviewItRule({
  name: "no-detached-test-file--move-beside-source",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a .test.ts or .test.tsx file to sit beside a source file of the same name, so the pair is tied together by the path and a test cannot be left behind when its source moves",
      relatedGuidelines: [],
    },
    messages: {
      detachedTestFile:
        "A test file must sit in the directory of the source it tests and carry that source's name with `.test` in front of the extension, because the path is the only thing that ties the pair together, and a test placed anywhere else stays behind the moment its source moves or is renamed. Nothing exists at `{{sourcePath}}`. Move this file next to the source it tests and name it after that source; if that source is gone, delete this file with it.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node: ESTree.Program) {
        const sourcePath = sourcePathFor(context.filename);
        if (sourcePath === null) return;
        if (pathExists(sourcePath)) return;
        context.report({ node, messageId: "detachedTestFile", data: { sourcePath } });
      },
    };
  },
});
