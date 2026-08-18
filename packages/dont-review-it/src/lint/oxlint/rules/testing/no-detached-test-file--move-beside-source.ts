import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { segmentsOf } from "../../lib/path-segments.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const DEFAULT_TEST_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];

const pathExists = memoize((path: string): boolean => existsSync(path));

const stringsFrom = (
  ruleOptions: Readonly<Options>,
  named: "testFileSuffixes" | "exemptPaths",
): readonly string[] => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];
  const configured = first[named];
  if (!Array.isArray(configured)) return [];
  return configured.filter((candidate): candidate is string => typeof candidate === "string");
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

const isExemptPath = (pathSegments: readonly string[], exemptPaths: readonly string[]): boolean =>
  exemptPaths.some((exemptPath) =>
    containsSegmentRun(pathSegments, segmentsOf({ path: exemptPath, separator: "/" })),
  );

const TEST_ONLY_DIRECTORY_NAMES = new Set(["test", "tests", "__tests__", "spec"]);

const findingFor = (
  testPath: string,
  {
    suffixes,
    exemptPaths,
  }: { readonly suffixes: readonly string[]; readonly exemptPaths: readonly string[] },
): {
  readonly messageId: "detachedTestFile" | "testOnlyDirectory";
  readonly data: Readonly<Record<string, string>>;
} | null => {
  const suffix = longestMatchingSuffix(testPath, suffixes);
  const pathSegments = segmentsOf({ path: testPath, separator: sep });
  if (suffix === null || isExemptPath(pathSegments, exemptPaths)) return null;

  const sourcePath = sourcePathFor(testPath, suffix);
  if (!pathExists(sourcePath)) return { messageId: "detachedTestFile", data: { sourcePath } };

  const directory = pathSegments
    .slice(0, -1)
    .find((segment) => TEST_ONLY_DIRECTORY_NAMES.has(segment));
  return directory === undefined ? null : { messageId: "testOnlyDirectory", data: { directory } };
};

export const noDetachedTestFile = createDontReviewItRule({
  name: "no-detached-test-file--move-beside-source",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a test file to sit in the directory of the source it tests under that source's name, so the pair is tied together by the path and a test cannot be left behind when its source moves",
      relatedGuidelines: ["AGENTS.md"],
    },
    messages: {
      detachedTestFile:
        "A test file must not sit apart from the source it tests. Nothing exists at `{{sourcePath}}`. Move this file into the directory of the source it tests and name it after that source.",
      testOnlyDirectory:
        "A test file must not sit under a directory that exists only to hold tests. This file sits under `{{directory}}`. Move the source it tests back among the modules that use it, and move this file with it.",
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
  create(inspection) {
    const suffixes = [
      ...DEFAULT_TEST_FILE_SUFFIXES,
      ...stringsFrom(inspection.options, "testFileSuffixes"),
    ];
    const exemptPaths = stringsFrom(inspection.options, "exemptPaths");

    return {
      Program(node: ESTree.Program) {
        const finding = findingFor(resolve(inspection.cwd, inspection.filename), {
          suffixes,
          exemptPaths,
        });
        if (finding === null) return;
        inspection.report({ node, messageId: finding.messageId, data: finding.data });
      },
    };
  },
});
