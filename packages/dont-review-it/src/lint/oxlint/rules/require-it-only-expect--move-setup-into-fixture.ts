import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  ASSERTION_CHAIN_MODIFIERS,
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

const TEST_BLOCK_NAME = "it";

const ASSERTION_NAMESPACE = "expect";

const ALLOWED_UTILITIES_OPTION = "allowedExpectUtilities";

const DEFAULT_ALLOWED_UTILITIES: ReadonlySet<string> = new Set(["assertions", "hasAssertions"]);

const allowedUtilitiesFrom = (options: Readonly<Options>): ReadonlySet<string> => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return DEFAULT_ALLOWED_UTILITIES;
  }

  const listed = first[ALLOWED_UTILITIES_OPTION];
  return Array.isArray(listed) ? new Set(listed.map(String)) : DEFAULT_ALLOWED_UTILITIES;
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

const isSpelledName = (node: ESTree.Expression): boolean => {
  const written = unwrapSubject(node);
  if (written.type === "TemplateLiteral") return true;
  return written.type === "Literal" && typeof written.value === "string";
};

const testCallbackOf = (call: ESTree.CallExpression): SpecFunction | null => {
  if (testBlockRootName(call.callee) !== TEST_BLOCK_NAME) return null;

  const handed = call.arguments.flatMap((argument) =>
    argument.type === "SpreadElement" ? [] : [argument],
  );
  const [named] = handed;
  if (named === undefined || !isSpelledName(named)) return null;
  return handed.flatMap((argument) => asSpecFunction(argument) ?? []).at(-1) ?? null;
};

const statementsOf = (callback: SpecFunction): readonly SpecStatement[] => {
  const body = blockBodyOf(callback);
  return body === null ? [] : body.body;
};

const conciseBodyOf = (callback: SpecFunction): ESTree.Expression | null => {
  const { body } = callback;
  return body === null || body.type === "BlockStatement" ? null : body;
};

const spansExecutedArgument = (
  call: ESTree.CallExpression,
  executions: ReadonlySet<ESTree.Node>,
): boolean =>
  [...executions].some((execution) =>
    call.arguments.some(
      (argument) => execution.start >= argument.start && execution.end <= argument.end,
    ),
  );

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
  create(context) {
    if (!isSpecFile(context.filename, specFileSuffixesFrom(context.options))) return {};

    const allowed = allowedUtilitiesFrom(context.options);
    const pending = new Set<{ readonly node: ESTree.Node; readonly messageId: string }>();
    const utilityCalls = new Set<ESTree.CallExpression>();
    const executions = new Set<ESTree.Node>();

    const readExpression = (read: {
      readonly expression: ESTree.Expression;
      readonly reported: ESTree.Node;
      readonly messageId: string;
    }): void => {
      const utility = namespaceUtilityIn(read.expression, allowed);
      if (utility !== null) {
        utilityCalls.add(utility);
        return;
      }
      if (isAssertion(read.expression)) return;
      pending.add({ node: read.reported, messageId: read.messageId });
    };

    const readStatement = (statement: SpecStatement): void => {
      const messageId = "setupStatement";
      if (statement.type === "ExpressionStatement") {
        readExpression({ expression: statement.expression, reported: statement, messageId });
        return;
      }
      if (statement.type === "ReturnStatement" && statement.argument !== null) {
        readExpression({ expression: statement.argument, reported: statement, messageId });
        return;
      }
      pending.add({ node: statement, messageId });
    };

    const readCallback = (callback: SpecFunction): void => {
      for (const statement of statementsOf(callback)) readStatement(statement);

      const concise = conciseBodyOf(callback);
      if (concise === null) return;
      readExpression({ expression: concise, reported: concise, messageId: "nonAssertionBody" });
    };

    return {
      CallExpression(node: ESTree.CallExpression) {
        executions.add(node);
        const callback = testCallbackOf(node);
        if (callback !== null) readCallback(callback);
      },
      NewExpression(node: ESTree.NewExpression) {
        executions.add(node);
      },
      AssignmentExpression(node: ESTree.AssignmentExpression) {
        executions.add(node);
      },
      "Program:exit"() {
        for (const report of pending) context.report(report);
        for (const call of utilityCalls) {
          if (!spansExecutedArgument(call, executions)) continue;
          context.report({ node: call, messageId: "utilityArgument" });
        }
      },
    };
  },
});
