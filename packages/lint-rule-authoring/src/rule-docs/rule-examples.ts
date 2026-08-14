import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseSync } from "oxc-parser";

import {
  isAstNode,
  moduleConstantsIn,
  nodesIn,
  propertyOf,
  resolveText,
  type ConstantsByName,
} from "../static-source-values.ts";

import type { UnknownFields } from "../unknown-fields.ts";

export type LintRuleExample = {
  readonly name: string;
  readonly code: string;
  readonly filename: string | null;
};

export type LintRuleExamples = {
  readonly valid: readonly LintRuleExample[];
  readonly invalid: readonly LintRuleExample[];
};

const TESTER_NAME = "testLintRule";

const isNode = (candidate: unknown): candidate is UnknownFields =>
  isAstNode(candidate) && typeof candidate.type === "string";

const nodesUnder = (node: UnknownFields): readonly UnknownFields[] => [
  node,
  ...Object.values(node).flatMap((field) => {
    if (Array.isArray(field)) return field.filter(isNode).flatMap(nodesUnder);
    return isNode(field) ? nodesUnder(field) : [];
  }),
];

const casesObjectIn = (statements: readonly UnknownFields[]): UnknownFields | null =>
  statements
    .flatMap(nodesUnder)
    .filter((node) => node.type === "CallExpression")
    .filter((call) => {
      const callee = call.callee as UnknownFields;
      return callee.type === "Identifier" && callee.name === TESTER_NAME;
    })
    .map((call) => nodesIn(call.arguments).at(1) ?? null)
    .find((argument) => argument?.type === "ObjectExpression") ?? null;

const isMarked = (testCase: UnknownFields): boolean => {
  const marker = propertyOf(testCase, "documented");
  return marker?.type === "Literal" && marker.value === true;
};

const exampleOf = ({
  testCase,
  constants,
}: {
  readonly testCase: UnknownFields;
  readonly constants: ConstantsByName;
}): readonly LintRuleExample[] => {
  const namedAs = propertyOf(testCase, "name");
  const written = propertyOf(testCase, "code");
  const placedAt = propertyOf(testCase, "filename");
  const caseName = namedAs === null ? null : resolveText({ node: namedAs, constants, visited: [] });
  const code = written === null ? null : resolveText({ node: written, constants, visited: [] });
  const filename =
    placedAt === null ? null : resolveText({ node: placedAt, constants, visited: [] });
  return caseName === null || code === null ? [] : [{ name: caseName, code, filename }];
};

const markedExamplesIn = ({
  cases,
  field,
  constants,
}: {
  readonly cases: UnknownFields;
  readonly field: string;
  readonly constants: ConstantsByName;
}): readonly LintRuleExample[] => {
  const listed = propertyOf(cases, field);
  if (listed === null) return [];
  return nodesIn(listed.elements)
    .filter((listedCase) => listedCase.type === "ObjectExpression")
    .filter(isMarked)
    .flatMap((testCase) => exampleOf({ testCase, constants }));
};

const NO_EXAMPLES: LintRuleExamples = { valid: [], invalid: [] };

export const testFilePathFor = (sourcePath: string): string =>
  sourcePath.replace(/\.ts$/u, ".test.ts");

export const lintRuleExamplesIn = ({
  workspaceRoot,
  sourcePath,
}: {
  readonly workspaceRoot: string;
  readonly sourcePath: string;
}): LintRuleExamples => {
  const testPath = testFilePathFor(sourcePath);
  const absolutePath = join(workspaceRoot, testPath);
  if (!existsSync(absolutePath)) return NO_EXAMPLES;

  const statements = nodesIn(parseSync(testPath, readFileSync(absolutePath, "utf8")).program.body);
  const cases = casesObjectIn(statements);
  if (cases === null) return NO_EXAMPLES;

  const constants = moduleConstantsIn(statements);
  return {
    valid: markedExamplesIn({ cases, field: "valid", constants }),
    invalid: markedExamplesIn({ cases, field: "invalid", constants }),
  };
};
