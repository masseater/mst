import { parseSync } from "oxc-parser";

import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";
import {
  DEFAULT_SOURCE_NAME,
  nodeCountOf,
  structureOf,
  type BodyDeclaration,
} from "../duplicated-bodies/declarations.ts";
import { FIXTURE_BUILDER_MEMBER } from "../spec-syntax/fixture-declarations.ts";
import {
  INJECTED_GROUPING_BLOCK_SPELLINGS,
  INJECTED_TEST_BLOCK_SPELLINGS,
} from "../spec-syntax/test-block-declarations.ts";

const RUNNER_BODY_TYPES: ReadonlySet<string> = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
]);

const receiverOf = (callee: AstFields): unknown => {
  if (callee[NODE_TYPE_FIELD] === "CallExpression") return callee.callee;
  if (callee[NODE_TYPE_FIELD] !== "MemberExpression") return null;
  const member = callee.property;
  return isAstFields(member) && member.name === FIXTURE_BUILDER_MEMBER ? null : callee.object;
};

const calleeRootName = (callee: unknown): string | null => {
  if (!isAstFields(callee)) return null;
  if (callee[NODE_TYPE_FIELD] === "Identifier") return String(callee.name);
  return calleeRootName(receiverOf(callee));
};

const titleOf = (handedArgument: unknown): string | null => {
  if (!isAstFields(handedArgument) || handedArgument[NODE_TYPE_FIELD] !== "Literal") return null;
  return typeof handedArgument.value === "string" ? handedArgument.value : null;
};

const runnerBodyOf = (handedArgument: unknown): unknown =>
  isAstFields(handedArgument) && RUNNER_BODY_TYPES.has(String(handedArgument[NODE_TYPE_FIELD]))
    ? handedArgument.body
    : null;

const testCaseOf = (call: AstFields, source: string): BodyDeclaration | null => {
  const rootName = calleeRootName(call.callee);
  if (rootName === null || !INJECTED_TEST_BLOCK_SPELLINGS.has(rootName)) return null;

  const handedArguments = call.arguments as readonly unknown[];
  const title = titleOf(handedArguments[0]);
  const runnerBody = handedArguments.map(runnerBodyOf).find((written) => written !== null);
  if (title === null || runnerBody === undefined) return null;

  return {
    name: title,
    line: source.slice(0, Number(call.start)).split("\n").length,
    structure: structureOf(runnerBody),
    nodeCount: nodeCountOf(runnerBody),
  };
};

const testCaseIn = (syntaxField: AstFields, source: string): BodyDeclaration | null =>
  syntaxField[NODE_TYPE_FIELD] === "CallExpression" ? testCaseOf(syntaxField, source) : null;

const situationBelow = (
  syntaxField: AstFields,
  situation: readonly string[],
): readonly string[] => {
  if (syntaxField[NODE_TYPE_FIELD] !== "CallExpression") return situation;

  const rootName = calleeRootName(syntaxField.callee);
  if (rootName === null || !INJECTED_GROUPING_BLOCK_SPELLINGS.has(rootName)) return situation;

  const groupTitle = titleOf((syntaxField.arguments as readonly unknown[])[0]);
  return groupTitle === null ? situation : [...situation, groupTitle];
};

const situatedTestCasesIn = (
  syntaxField: unknown,
  { situation, source }: { readonly situation: readonly string[]; readonly source: string },
): readonly { readonly declaration: BodyDeclaration; readonly situation: readonly string[] }[] => {
  if (Array.isArray(syntaxField))
    return syntaxField.flatMap((part) => situatedTestCasesIn(part, { situation, source }));
  if (!isAstFields(syntaxField)) return [];

  const testCase = testCaseIn(syntaxField, source);
  if (testCase !== null) return [{ declaration: testCase, situation }];

  const grouped = situationBelow(syntaxField, situation);
  return Object.values(syntaxField).flatMap((part) =>
    situatedTestCasesIn(part, { situation: grouped, source }),
  );
};

export const repeatedTestCasesIn = (source: string): readonly BodyDeclaration[] => {
  const parsedSource = parseSync(DEFAULT_SOURCE_NAME, source);
  const testCases = situatedTestCasesIn(parsedSource.program.body, { situation: [], source });
  const spellings = testCases.map((testCase) =>
    JSON.stringify([testCase.situation, testCase.declaration.name, testCase.declaration.structure]),
  );
  return testCases
    .filter((_, index) =>
      spellings.some(
        (spelling, comparedIndex) => comparedIndex !== index && spelling === spellings[index],
      ),
    )
    .map((testCase) => testCase.declaration);
};
