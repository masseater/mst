import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { joinCandidateSets } from "../lib/canonical-values/candidate-set.ts";
import { createCanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import {
  type createCanonicalValueInvocationState,
  createCanonicalValueRuntimeState,
} from "./canonical-value-invocation.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import { withOwner } from "./canonical-value-rule-test-fixture.ts";

import type { Context, ESTree } from "@oxlint/plugins";

const originText = (context: Context, origin: CanonicalValueOrigin): string => {
  if (origin.kind === "absent") return "absent";
  const suffixes = origin.projections.map((projection) => {
    if (projection.kind === "property") return `property:${projection.path.join(".")}`;
    if (projection.kind === "array-slice") return `slice:${projection.startIndex}`;
    if (projection.kind === "call-arguments") return `arguments:${projection.startIndex}`;
    if (projection.kind === "object-rest") return `rest:${projection.excludedKeys.join(",")}`;
    return projection.kind;
  });
  return [context.sourceCode.getText(origin.expression), ...suffixes].join("|");
};

const literalString = (argument: ESTree.Argument | undefined): string | null =>
  argument?.type === "Literal" && typeof argument.value === "string" ? argument.value : null;

const literalIndex = (argument: ESTree.Argument | undefined): number | null =>
  argument?.type === "Literal" && typeof argument.value === "number" ? argument.value : null;

const invocationArgument = (
  argument: ESTree.Argument | undefined,
): ESTree.CallExpression | ESTree.NewExpression | null =>
  argument?.type === "CallExpression" || argument?.type === "NewExpression" ? argument : null;

const argumentOriginSummary = (
  context: Context,
  input: {
    readonly index: number;
    readonly invocation: ESTree.CallExpression | ESTree.NewExpression;
    readonly state: ReturnType<typeof createCanonicalValueInvocationState>;
  },
): string => {
  const facts = input.state.facts(input.invocation);
  const originSets = facts.candidates.map((fact) => input.state.argumentOrigins(fact, input.index));
  const joined = joinCandidateSets(originSets, canonicalValueOriginKey);
  const complete = facts.complete && joined.complete;
  const spellings = joined.candidates.map((origin) => originText(context, origin)).toSorted();
  return `${complete ? "closed" : "open"}:${spellings.join(",")}`;
};

const inspectArgumentOrigin = (
  context: Context,
  input: {
    readonly node: ESTree.CallExpression;
    readonly state: ReturnType<typeof createCanonicalValueInvocationState>;
  },
): void => {
  if (input.node.callee.type !== "Identifier" || input.node.callee.name !== "expectArgument")
    return;
  const invocation = invocationArgument(input.node.arguments[0]);
  const index = literalIndex(input.node.arguments[1]);
  const expected = literalString(input.node.arguments[2]);
  if (invocation === null || index === null || expected === null) return;
  const summary = argumentOriginSummary(context, { index, invocation, state: input.state });
  if (summary === expected) return;
  context.report({
    data: { actual: summary, expected },
    messageId: "unexpected",
    node: invocation,
  });
};

const argumentOriginsRule = createDontReviewItRule({
  name: "canonical-value-invocation-arguments",
  meta: {
    type: "problem",
    docs: { description: "Exercise canonical invocation arguments", relatedGuidelines: [] },
    messages: { unexpected: "Expected {{expected}}, received {{actual}}." },
    schema: [],
  },
  create(context) {
    const bindingIndex = createCanonicalValueBindingIndex(context.sourceCode);
    const { invocationState: state } = createCanonicalValueRuntimeState(bindingIndex);
    return {
      AssignmentExpression: bindingIndex.recordAssignment,
      CallExpression: (node: ESTree.CallExpression) => {
        inspectArgumentOrigin(context, { node, state });
      },
      VariableDeclarator: bindingIndex.recordVariableDeclarator,
    };
  },
});

describe("canonical value invocation arguments", () => {
  testLintRule(argumentOriginsRule, {
    valid: [
      {
        name: "a direct argument keeps its origin",
        code: 'const statuses = ["draft", "published"] as const;\nexpectArgument(z.enum(statuses), 0, "closed:[\\"draft\\", \\"published\\"]");',
      },
      {
        name: "a later direct argument keeps its logical index",
        code: 'expectArgument(z.enum(first, second), 1, "closed:second");',
      },
      {
        name: "a spread array supplies its first logical argument",
        code: 'const statuses = ["draft", "published"] as const;\nexpectArgument(z.enum(...[statuses]), 0, "closed:[\\"draft\\", \\"published\\"]");',
      },
      {
        name: "a spread array alias supplies its first logical argument",
        code: 'const statuses = ["draft", "published"] as const;\nconst args = [statuses] as const;\nexpectArgument(z.enum(...args), 0, "closed:[\\"draft\\", \\"published\\"]");',
      },
      {
        name: "apply exposes its array as logical arguments",
        code: 'const statuses = ["draft", "published"] as const;\nexpectArgument(z.enum.apply(z, [statuses]), 0, "closed:[\\"draft\\", \\"published\\"]");',
      },
      {
        name: "a pre-bound argument precedes call-site arguments",
        code: 'const define = z.literal.bind(z, "draft");\nexpectArgument(define("published"), 0, "closed:\\"draft\\"");\nexpectArgument(define("published"), 1, "closed:\\"published\\"");',
      },
      {
        name: "bind creation is not itself an invocation",
        code: 'expectArgument(z.literal.bind(z, "draft"), 0, "closed:");',
      },
      {
        name: "a pre-bound apply route exposes its array argument",
        code: 'const define = z.enum.apply.bind(z.enum, z);\nconst statuses = ["draft", "published"] as const;\nexpectArgument(define([statuses]), 0, "closed:[\\"draft\\", \\"published\\"]");',
      },
      {
        name: "a known spread width shifts a later argument",
        code: 'expectArgument(z.enum(...[ignored], statuses), 1, "closed:statuses");',
      },
      {
        name: "an unknown spread retains a later index-zero candidate",
        code: 'expectArgument(z.enum(...runtimeArgs, statuses), 0, "open:runtimeArgs|property:0,statuses");',
      },
      {
        name: "an unknown spread retains every later index-one outcome",
        code: 'expectArgument(z.enum(...runtimeArgs, statuses), 1, "open:absent,runtimeArgs|property:1,statuses");',
      },
      {
        name: "a missing logical argument is absent",
        code: 'expectArgument(z.enum(), 0, "closed:absent");',
      },
      {
        name: "a Set constructor uses the shared logical argument API",
        code: 'expectArgument(new Set(statuses), 0, "closed:statuses");',
      },
      {
        name: "Set add uses the shared logical argument API",
        code: 'expectArgument(statuses.add("archived"), 0, "closed:\\"archived\\"");',
      },
    ],
    invalid: [],
  });
});

describe("no-local invocation arguments", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "a later arguments object member is not the schema input",
        code: 'function invoke() { return z.enum.apply(null, [runtimeValues(), ["draft", "published"]]); }\ninvoke();',
      },
    ],
    invalid: [
      {
        name: "an arguments object apply route projects its call occurrence",
        code: 'function invoke() { return z.enum.apply(null, arguments); }\ninvoke(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an aliased arguments object apply route projects its call occurrence",
        code: 'function invoke() { const args = arguments; return z.enum.apply(null, args); }\ninvoke(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an arguments object spread route projects its call occurrence",
        code: 'function invoke() { return z.enum(...arguments); }\ninvoke(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});
