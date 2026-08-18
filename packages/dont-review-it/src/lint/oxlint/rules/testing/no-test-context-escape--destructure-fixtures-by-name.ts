import { createDontReviewItRule } from "../../../../create-rule.ts";
import { nodesOfType } from "../../lib/nodes-of-type.ts";
import { fixtureDeclarationsOf } from "../../lib/spec-syntax/fixture-declarations.ts";
import {
  isHeldContextReach,
  type ContextReach,
  type HeldContext,
} from "../../lib/spec-syntax/held-contexts.ts";
import { unwrapSubject, type SpecFunction } from "../../lib/spec-syntax/subject-expressions.ts";
import {
  declaresTestBlock,
  testBlockRootNames,
  testCallbacksOf,
} from "../../lib/spec-syntax/test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";

type ContextFault = {
  readonly node: ESTree.Node;
  readonly messageId: string;
};

const restFaultsIn = (pattern: ESTree.ObjectPattern): readonly ContextFault[] =>
  pattern.properties.flatMap((property) =>
    property.type === "RestElement" ? [{ node: property, messageId: "restContext" }] : [],
  );

const writtenBinding = (bound: ESTree.ParamPattern): ESTree.ParamPattern =>
  bound.type === "AssignmentPattern" ? bound.left : bound;

const objectPatternOf = (bound: ESTree.ParamPattern): ESTree.ObjectPattern | null => {
  const written = writtenBinding(bound);
  return written.type === "ObjectPattern" ? written : null;
};

const computedKeyFaultsIn = (pattern: ESTree.ObjectPattern): readonly ContextFault[] =>
  pattern.properties.flatMap((property) => {
    if (property.type !== "Property") return [];

    const nested = objectPatternOf(property.value);
    const deeper = nested === null ? [] : computedKeyFaultsIn(nested);
    return property.computed
      ? [{ node: property.key, messageId: "computedContextKey" }, ...deeper]
      : deeper;
  });

const contextFaultsOf = (taker: SpecFunction): readonly ContextFault[] => {
  const [parameter] = taker.params;
  if (parameter === undefined) return [];

  const pattern = objectPatternOf(parameter);
  return pattern === null
    ? [{ node: parameter, messageId: "wholeContext" }]
    : [...restFaultsIn(pattern), ...computedKeyFaultsIn(pattern)];
};

const heldContextOf = (taker: SpecFunction): readonly HeldContext[] => {
  const [parameter] = taker.params;
  if (parameter === undefined) return [];

  const written = writtenBinding(parameter);
  return written.type === "Identifier"
    ? [{ name: written.name, start: taker.start, end: taker.end }]
    : [];
};

const peeledFactoriesOf = (handed: ESTree.Expression): readonly SpecFunction[] => {
  const written = unwrapSubject(handed);
  return written.type === "CallExpression" ? testCallbacksOf(written) : [];
};

const fixtureFactoriesOf = (call: ESTree.CallExpression): readonly SpecFunction[] =>
  fixtureDeclarationsOf(call).flatMap(({ factory, subjects }) =>
    factory === null ? subjects.flatMap(peeledFactoriesOf) : [factory],
  );

const contextTakersOf = (
  call: ESTree.CallExpression,
  rootNames: ReadonlySet<string>,
): readonly SpecFunction[] => [
  ...(declaresTestBlock(call, rootNames) ? testCallbacksOf(call) : []),
  ...fixtureFactoriesOf(call),
];

const argumentValueOf = (argument: ESTree.Argument): ESTree.Expression =>
  argument.type === "SpreadElement" ? argument.argument : argument;

export const noTestContextEscape = createDontReviewItRule({
  name: "no-test-context-escape--destructure-fixtures-by-name",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a test callback or a fixture factory holding the test context as anything but a pattern of statically readable fixture names, so the fixtures a test depends on stay listed in its parameter and the rules that read those names keep deciding",
      relatedGuidelines: ["docs/guidelines/tests.md"],
    },
    messages: {
      restContext:
        "A test context must not be gathered into a rest binding. List the fixtures this test uses as separate names in the pattern.",
      wholeContext:
        "A test context must not be bound as a whole. List the fixtures this test uses in an object pattern, and take each one out by name.",
      computedContextKey:
        "A key of a test context pattern must not be written as a subscript. Name the fixture this key stands for as a static key.",
      traversedContext:
        "A test context must not be spread, enumerated, subscripted, or handed to another function. List the fixtures `{{held}}` stands for in an object pattern, and take each one out by name.",
    },
    schema: [],
  },
  create(inspection) {
    const reachesTo = (node: ESTree.Node, written: ESTree.Expression): readonly ContextReach[] => {
      const reached = unwrapSubject(written);
      return reached.type === "Identifier" ? [{ node, name: reached.name }] : [];
    };

    const reachesInArguments = (handed: readonly ESTree.Argument[]): readonly ContextReach[] =>
      handed.flatMap((argument) => reachesTo(argument, argumentValueOf(argument)));

    return {
      "Program:exit"(program: ESTree.Program) {
        const rootNames = testBlockRootNames(program);
        const takers = new Set(
          nodesOfType(program, "CallExpression").flatMap((call) =>
            contextTakersOf(call, rootNames),
          ),
        );

        for (const taker of takers) {
          for (const fault of contextFaultsOf(taker)) {
            inspection.report({ node: fault.node, messageId: fault.messageId });
          }
        }

        const reaches = [
          ...nodesOfType(program, "CallExpression").flatMap((node) =>
            reachesInArguments(node.arguments),
          ),
          ...nodesOfType(program, "NewExpression").flatMap((node) =>
            reachesInArguments(node.arguments),
          ),
          ...nodesOfType(program, "MemberExpression").flatMap((node) =>
            node.computed ? reachesTo(node, node.object) : [],
          ),
          ...nodesOfType(program, "ObjectExpression").flatMap((node) =>
            node.properties.flatMap((property) =>
              property.type === "SpreadElement" ? reachesTo(property, property.argument) : [],
            ),
          ),
          ...nodesOfType(program, "ForInStatement").flatMap((node) =>
            reachesTo(node.right, node.right),
          ),
        ];

        const held = [...takers].flatMap(heldContextOf);
        for (const reach of reaches) {
          if (!isHeldContextReach(reach, held)) continue;
          inspection.report({
            node: reach.node,
            messageId: "traversedContext",
            data: { held: reach.name },
          });
        }
      },
    };
  },
});
