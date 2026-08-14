import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import {
  ASSERTION_CHAIN_MODIFIERS,
  ASSERTION_COUNT_DECLARATIONS,
  DERIVED_ASSERTION_RECEIVERS,
} from "../lib/spec-syntax/matcher-vocabulary.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import {
  asSpecFunction,
  blockBodyOf,
  unwrapSubject,
  type SpecFunction,
  type SpecStatement,
} from "../lib/spec-syntax/subject-expressions.ts";
import { testBlockRootName } from "../lib/spec-syntax/test-block-modifiers.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const ALLOWED_UTILITIES_OPTION = "allowedExpectUtilities";

const allowedUtilitiesFrom = (ruleOptions: Readonly<Options>): ReadonlySet<string> => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return ASSERTION_COUNT_DECLARATIONS;
  }

  const listed = first[ALLOWED_UTILITIES_OPTION];
  return Array.isArray(listed) ? new Set(listed.map(String)) : ASSERTION_COUNT_DECLARATIONS;
};

const isSpelledName = (node: ESTree.Expression): boolean => {
  const written = unwrapSubject(node);
  if (written.type === "TemplateLiteral") return true;
  return written.type === "Literal" && typeof written.value === "string";
};

const TEST_BLOCK_NAME = "it";

const testCallbackOf = (call: ESTree.CallExpression): SpecFunction | null => {
  if (testBlockRootName(call.callee) !== TEST_BLOCK_NAME) return null;

  const handed = call.arguments.flatMap((argument) =>
    argument.type === "SpreadElement" ? [] : [argument],
  );
  const [named] = handed;
  if (named === undefined || !isSpelledName(named)) return null;
  return handed.flatMap((argument) => asSpecFunction(argument) ?? []).at(-1) ?? null;
};

type Reading = {
  readonly expression: ESTree.Expression | null;
  readonly reported: ESTree.Node;
  readonly messageId: string;
};

const readingOf = (statement: SpecStatement): Reading => {
  const messageId = "setupStatement";
  if (statement.type === "ExpressionStatement") {
    return { expression: statement.expression, reported: statement, messageId };
  }
  if (statement.type === "ReturnStatement" && statement.argument !== null) {
    return { expression: statement.argument, reported: statement, messageId };
  }
  return { expression: null, reported: statement, messageId };
};

const statementsOf = (takenFunction: SpecFunction): readonly SpecStatement[] => {
  const writtenBody = blockBodyOf(takenFunction);
  return writtenBody === null ? [] : writtenBody.body;
};

const conciseBodyOf = (takenFunction: SpecFunction): ESTree.Expression | null => {
  const { body } = takenFunction;
  return body === null || body.type === "BlockStatement" ? null : body;
};

const readingsIn = (takenFunction: SpecFunction): readonly Reading[] => {
  const concise = conciseBodyOf(takenFunction);
  return [
    ...statementsOf(takenFunction).map((statement) => readingOf(statement)),
    ...(concise === null
      ? []
      : [{ expression: concise, reported: concise, messageId: "nonAssertionBody" }]),
  ];
};

const namespaceReceiverOf = (call: ESTree.CallExpression): string | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type === "Identifier") return callee.name;
  if (callee.type !== "MemberExpression") return null;

  const derived = staticMemberName(callee);
  if (derived === null || !DERIVED_ASSERTION_RECEIVERS.has(derived)) return null;

  const namespace = unwrapSubject(callee.object);
  return namespace.type === "Identifier" ? namespace.name : null;
};

const ASSERTION_NAMESPACE = "expect";

const standsOnAssertionEntry = (node: ESTree.Expression): boolean => {
  const written = unwrapSubject(node);
  if (written.type === "CallExpression") {
    return namespaceReceiverOf(written) === ASSERTION_NAMESPACE;
  }
  if (written.type !== "MemberExpression") return false;

  const modifier = staticMemberName(written);
  if (modifier === null || !ASSERTION_CHAIN_MODIFIERS.has(modifier)) return false;
  return standsOnAssertionEntry(written.object);
};

const isAssertion = (node: ESTree.Expression): boolean => {
  const written = unwrapSubject(node);
  if (written.type !== "CallExpression") return false;

  const callee = unwrapSubject(written.callee);
  if (callee.type !== "MemberExpression" || staticMemberName(callee) === null) return false;
  return standsOnAssertionEntry(callee.object);
};

const namespaceUtilityIn = (
  node: ESTree.Expression,
  allowed: ReadonlySet<string>,
): ESTree.CallExpression | null => {
  const written = unwrapSubject(node);
  if (written.type !== "CallExpression") return null;

  const callee = unwrapSubject(written.callee);
  if (callee.type !== "MemberExpression") return null;

  const namespace = unwrapSubject(callee.object);
  if (namespace.type !== "Identifier" || namespace.name !== ASSERTION_NAMESPACE) return null;

  const utility = staticMemberName(callee);
  return utility !== null && allowed.has(utility) ? written : null;
};

const carriesSetup = (reading: Reading, allowed: ReadonlySet<string>): boolean => {
  if (reading.expression === null) return true;
  if (namespaceUtilityIn(reading.expression, allowed) !== null) return false;
  return !isAssertion(reading.expression);
};

const spansExecutedArgument = (
  call: ESTree.CallExpression,
  executions: readonly ESTree.Node[],
): boolean =>
  executions.some((execution) =>
    call.arguments.some(
      (argument) => execution.start >= argument.start && execution.end <= argument.end,
    ),
  );

const executedUtilitiesIn = (read: {
  readonly reading: Reading;
  readonly allowed: ReadonlySet<string>;
  readonly executions: readonly ESTree.Node[];
}): readonly ESTree.CallExpression[] => {
  const { expression } = read.reading;
  const utility = expression === null ? null : namespaceUtilityIn(expression, read.allowed);
  if (utility === null || !spansExecutedArgument(utility, read.executions)) return [];
  return [utility];
};

export const requireItOnlyExpect = createDontReviewItRule({
  name: "require-it-only-expect--move-setup-into-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a statement other than an assertion in the body of a test block, so the subject every assertion reads is the one its fixture handed over",
      relatedGuidelines: [],
    },
    messages: {
      setupStatement:
        "The body of `it` must not carry a statement other than an assertion. Move the preparation, the intermediate bindings and the call under test into the fixture, have the fixture hand back the subject, and leave the assertions against that subject standing here. Folding the same preparation into an argument of `expect`, into a helper declared in this spec file, or into a test hook keeps the same statement out of the fixture and is forbidden as well. Cleanup belongs to the shared runner configuration and must not be written back into `it`.",
      nonAssertionBody:
        "The body of `it` must not be an expression other than an assertion. Move the work this expression performs into the fixture, and write an assertion against the subject the fixture hands back.",
      utilityArgument:
        "An argument handed to an `expect` namespace utility must not carry a call, a construction or an assignment. Move that work into the fixture, and hand the utility a value spelled out here.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedExpectUtilities: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const allowed = allowedUtilitiesFrom(inspection.options);

    return {
      "Program:exit"(program: ESTree.Program) {
        const calls = nodesOfType(program, "CallExpression");
        const readings = calls
          .flatMap((call) => testCallbackOf(call) ?? [])
          .flatMap((takenFunction) => readingsIn(takenFunction));
        const executions = [
          ...calls,
          ...nodesOfType(program, "NewExpression"),
          ...nodesOfType(program, "AssignmentExpression"),
        ];
        const findings = [
          ...readings
            .filter((reading) => carriesSetup(reading, allowed))
            .map((reading) => ({ node: reading.reported, messageId: reading.messageId })),
          ...readings
            .flatMap((reading) => executedUtilitiesIn({ reading, allowed, executions }))
            .map((utility) => ({ node: utility, messageId: "utilityArgument" })),
        ];

        for (const finding of findings) inspection.report(finding);
      },
    };
  },
});
