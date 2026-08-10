import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { segmentsOf } from "../lib/path-segments.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const DEFAULT_TEST_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];

const TEST_ONLY_DIRECTORY_NAMES = new Set(["test", "tests", "__tests__", "spec"]);

const existenceByPath = new Map<string, boolean>();

const pathExists = (path: string): boolean => {
  const remembered = existenceByPath.get(path);
  if (remembered !== undefined) return remembered;
  const present = existsSync(path);
  existenceByPath.set(path, present);
  return present;
};

const stringsFrom = (
  options: Readonly<Options>,
  key: "testFileSuffixes" | "exemptPaths",
): readonly string[] => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];
  const configured = first[key];
  if (!Array.isArray(configured)) return [];
  return configured.filter((entry): entry is string => typeof entry === "string");
};

const longestMatchingSuffix = (path: string, suffixes: readonly string[]): string | null =>
  suffixes
    .filter((suffix) => path.endsWith(suffix))
    .reduce<string | null>(
      (longest, suffix) => (longest === null || suffix.length > longest.length ? suffix : longest),
      null,
    );

const sourcePathFor = (testPath: string, suffix: string): string => {
  const lastDot = suffix.lastIndexOf(".");
  const extension = lastDot === -1 ? "" : suffix.slice(lastDot);
  return `${testPath.slice(0, testPath.length - suffix.length)}${extension}`;
};

const containsSegmentRun = (
  pathSegments: readonly string[],
  runSegments: readonly string[],
): boolean =>
  runSegments.length > 0 &&
  pathSegments.some((_, index) =>
    runSegments.every((segment, offset) => pathSegments[index + offset] === segment),
  );

export const noDetachedTestFile = createDontReviewItRule({
  name: "no-detached-test-file--move-beside-source",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a test file to sit in the directory of the source it tests under that source's name, so the pair is tied together by the path and a test cannot be left behind when its source moves",
      relatedGuidelines: [],
    },
    messages: {
      detachedTestFile:
        "A test file must sit in the directory of the source it tests and carry that source's name in front of the test suffix, because the path is the only thing that ties the pair together, and a test placed anywhere else stays behind the moment its source moves or is renamed. Nothing exists at `{{sourcePath}}`. Move this file into the directory of the source it tests and name it after that source. If nothing owns the behaviour it checks any more, fold it into the tests of whatever owns that behaviour now, or delete it.",
      testOnlyDirectory:
        "A test file must not sit under a directory that exists only to hold tests, because a tree of tests standing beside the tree of sources holds the pair together by a rule that is written nowhere and breaks without failing. This file sits under `{{directory}}`. Move the source it tests back among the modules that use it, and move this file with it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          testFileSuffixes: { type: "array", items: { type: "string" } },
          exemptPaths: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const suffixes = [
      ...DEFAULT_TEST_FILE_SUFFIXES,
      ...stringsFrom(context.options, "testFileSuffixes"),
    ];
    const exemptPaths = stringsFrom(context.options, "exemptPaths");

    return {
      Program(node: ESTree.Program) {
        const testPath = resolve(context.cwd, context.filename);
        const suffix = longestMatchingSuffix(testPath, suffixes);
        if (suffix === null) return;

        const pathSegments = segmentsOf({ path: testPath, separator: sep });
        if (
          exemptPaths.some((entry) =>
            containsSegmentRun(pathSegments, segmentsOf({ path: entry, separator: "/" })),
          )
        ) {
          return;
        }

        const sourcePath = sourcePathFor(testPath, suffix);
        if (!pathExists(sourcePath)) {
          context.report({ node, messageId: "detachedTestFile", data: { sourcePath } });
          return;
        }

        const directory = pathSegments
          .slice(0, -1)
          .find((segment) => TEST_ONLY_DIRECTORY_NAMES.has(segment));
        if (directory === undefined) return;
        context.report({ node, messageId: "testOnlyDirectory", data: { directory } });
      },
    };
  },
});
