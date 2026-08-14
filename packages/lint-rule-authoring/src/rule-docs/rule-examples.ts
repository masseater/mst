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
  readonly unspellable: readonly string[];
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

const casesObjectsIn = (statements: readonly UnknownFields[]): readonly UnknownFields[] =>
  statements
    .flatMap(nodesUnder)
    .filter((node) => node.type === "CallExpression")
    .filter((call) => {
      const callee = call.callee as UnknownFields;
      return callee.type === "Identifier" && callee.name === TESTER_NAME;
    })
    .flatMap((call) => nodesIn(call.arguments).slice(1, 2))
    .filter((argument) => argument.type === "ObjectExpression");

const isMarked = (testCase: UnknownFields): boolean => {
  const marker = propertyOf(testCase, "documented");
  return marker?.type === "Literal" && marker.value === true;
};

const fieldTextOf = ({
  testCase,
  fieldName,
  constants,
}: {
  readonly testCase: UnknownFields;
  readonly fieldName: string;
  readonly constants: ConstantsByName;
}): string | null => {
  const written = propertyOf(testCase, fieldName);
  return written === null ? null : resolveText({ node: written, constants, visited: [] });
};

const exampleOf = ({
  testCase,
  constants,
}: {
  readonly testCase: UnknownFields;
  readonly constants: ConstantsByName;
}): readonly LintRuleExample[] => {
  const caseName = fieldTextOf({ testCase, fieldName: "name", constants });
  const code = fieldTextOf({ testCase, fieldName: "code", constants });
  const filename = fieldTextOf({ testCase, fieldName: "filename", constants });
  return caseName === null || code === null ? [] : [{ name: caseName, code, filename }];
};

const markedCasesIn = ({
  cases,
  field,
}: {
  readonly cases: UnknownFields;
  readonly field: string;
}): readonly UnknownFields[] => {
  const listed = propertyOf(cases, field);
  if (listed === null) return [];
  return nodesIn(listed.elements)
    .filter((listedCase) => listedCase.type === "ObjectExpression")
    .filter(isMarked);
};

const UNNAMED_CASE = "a case that spells out no name";

const unspellableNamesIn = ({
  marked,
  constants,
}: {
  readonly marked: readonly UnknownFields[];
  readonly constants: ConstantsByName;
}): readonly string[] =>
  marked
    .filter((testCase) => exampleOf({ testCase, constants }).length === 0)
    .map((testCase) => fieldTextOf({ testCase, fieldName: "name", constants }) ?? UNNAMED_CASE);

const NO_EXAMPLES: LintRuleExamples = { valid: [], invalid: [], unspellable: [] };

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
  const declared = casesObjectsIn(statements);
  if (declared.length === 0) return NO_EXAMPLES;

  const constants = moduleConstantsIn(statements);
  const validCases = declared.flatMap((cases) => markedCasesIn({ cases, field: "valid" }));
  const invalidCases = declared.flatMap((cases) => markedCasesIn({ cases, field: "invalid" }));
  return {
    valid: validCases.flatMap((testCase) => exampleOf({ testCase, constants })),
    invalid: invalidCases.flatMap((testCase) => exampleOf({ testCase, constants })),
    unspellable: unspellableNamesIn({ marked: [...validCases, ...invalidCases], constants }),
  };
};
