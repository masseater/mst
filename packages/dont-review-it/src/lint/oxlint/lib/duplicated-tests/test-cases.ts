import { parseSync } from "oxc-parser";

import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";
import {
  DEFAULT_SOURCE_NAME,
  nodeCountOf,
  structureOf,
  type BodyDeclaration,
} from "../duplicated-bodies/declarations.ts";
import { FIXTURE_BUILDER_MEMBER } from "../spec-syntax/fixture-declarations.ts";
import { INJECTED_TEST_BLOCK_SPELLINGS } from "../spec-syntax/test-block-declarations.ts";

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

const callExpressionsIn = (syntaxField: unknown): readonly AstFields[] => {
  if (Array.isArray(syntaxField)) return syntaxField.flatMap(callExpressionsIn);
  if (!isAstFields(syntaxField)) return [];

  const nested = Object.values(syntaxField).flatMap(callExpressionsIn);
  return syntaxField[NODE_TYPE_FIELD] === "CallExpression" ? [syntaxField, ...nested] : nested;
};

const testCasesIn = (source: string): readonly BodyDeclaration[] => {
  const parsedSource = parseSync(DEFAULT_SOURCE_NAME, source);
  return callExpressionsIn(parsedSource.program.body).flatMap((call) => {
    const testCase = testCaseOf(call, source);
    return testCase === null ? [] : [testCase];
  });
};

export const repeatedTestCasesIn = (source: string): readonly BodyDeclaration[] => {
  const testCases = testCasesIn(source);
  const spellings = testCases.map((testCase) =>
    JSON.stringify([testCase.name, testCase.structure]),
  );
  return testCases.filter((_, index) =>
    spellings.some(
      (spelling, comparedIndex) => comparedIndex !== index && spelling === spellings[index],
    ),
  );
};
