import { createDontReviewItRule } from "../../../create-rule.ts";
import { createCanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import {
  type createCanonicalValueInvocationState,
  createCanonicalValueRuntimeState,
  type CanonicalValueInvocationArgumentSegment,
  type CanonicalValueInvocationFact,
  type CanonicalValueRecognizedInvocation,
} from "./canonical-value-invocation.ts";

import type { Context, ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueExpressionOrigin,
  CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";

const projectionSpelling = (
  projection: CanonicalValueRecognizedInvocation["target"]["origin"]["projections"][number],
): string => {
  if (projection.kind === "property") return `property:${projection.path.join(".")}`;
  if (projection.kind === "array-slice") return `slice:${projection.startIndex}`;
  if (projection.kind === "object-rest") return `rest:${projection.excludedKeys.join(",")}`;
  if (projection.kind === "array-transform") return `transform:${projection.method}`;
  if (projection.kind === "array-element") return "array-element";
  if (projection.kind === "call-arguments") return `arguments:${projection.startIndex}`;
  if (projection.kind === "property-name") return "property-name";
  return `static:${projection.values.join(",")}`;
};

const originSpelling = (context: Context, origin: CanonicalValueExpressionOrigin): string =>
  [
    context.sourceCode.getText(origin.expression),
    ...origin.projections.map(projectionSpelling),
  ].join("|");

const candidateOriginSpelling = (context: Context, origin: CanonicalValueOrigin): string =>
  origin.kind === "absent" ? "absent" : originSpelling(context, origin);

const segmentSpelling = (
  context: Context,
  segment: CanonicalValueInvocationArgumentSegment,
): string => {
  if (segment.kind === "array") return `array:${context.sourceCode.getText(segment.expression)}`;
  if (segment.kind === "source") {
    return `source:${context.sourceCode.getText(segment.expression)}:${segment.sourcePath
      .map((source) => source.kind)
      .join(".")}`;
  }
  return `direct:${segment.elements
    .map((element) => context.sourceCode.getText(element))
    .join(",")}`;
};

const targetSpelling = (
  context: Context,
  invocation: CanonicalValueRecognizedInvocation,
): string => {
  const target = invocation.target;
  const targetName = target.kind === "schema" ? `${target.kind}:${target.member}` : target.kind;
  const receiver =
    target.kind === "set-add" || target.kind === "set-clear" || target.kind === "set-delete"
      ? `|receiver:${originSpelling(context, target.receiver)}`
      : "";
  const thisArgument =
    invocation.thisArgument === null ? "none" : context.sourceCode.getText(invocation.thisArgument);
  const segments = invocation.argumentSegments.map((segment) => segmentSpelling(context, segment));
  return `${targetName}:${originSpelling(context, target.origin)}${receiver}|this:${thisArgument}|args:${segments.join("+")}`;
};

const factSpelling = (context: Context, fact: CanonicalValueInvocationFact): string => {
  const thisArgument =
    fact.thisArgument === null ? "none" : context.sourceCode.getText(fact.thisArgument);
  const segments = fact.argumentSegments.map((segment) => segmentSpelling(context, segment));
  return `${originSpelling(context, fact.target)}|this:${thisArgument}|args:${segments.join("+")}`;
};

const expectedSummary = (argument: ESTree.Argument | undefined): string | null =>
  argument?.type === "Literal" && typeof argument.value === "string" ? argument.value : null;

const inspectedInvocation = (
  argument: ESTree.Argument | undefined,
): ESTree.CallExpression | ESTree.NewExpression | null =>
  argument?.type === "CallExpression" || argument?.type === "NewExpression" ? argument : null;

const inspectInvocation = (
  context: Context,
  input: {
    readonly invocationState: ReturnType<typeof createCanonicalValueInvocationState>;
    readonly node: ESTree.CallExpression;
  },
): void => {
  if (input.node.callee.type !== "Identifier" || input.node.callee.name !== "expectInvocation")
    return;
  const invocation = inspectedInvocation(input.node.arguments[0]);
  const expected = expectedSummary(input.node.arguments[1]);
  if (invocation === null || expected === null) return;
  const recognized = input.invocationState.recognized(invocation);
  const invocationSummary = `${recognized.complete ? "closed" : "open"}:${recognized.candidates
    .map((candidate) => targetSpelling(context, candidate))
    .toSorted()
    .join(";")}`;
  if (invocationSummary === expected) return;
  context.report({
    data: { actual: invocationSummary, expected },
    messageId: "unexpected",
    node: invocation,
  });
};

const inspectFact = (
  context: Context,
  input: {
    readonly invocationState: ReturnType<typeof createCanonicalValueInvocationState>;
    readonly node: ESTree.CallExpression;
  },
): void => {
  if (input.node.callee.type !== "Identifier" || input.node.callee.name !== "expectFact") return;
  const invocation = inspectedInvocation(input.node.arguments[0]);
  const expected = expectedSummary(input.node.arguments[1]);
  if (invocation === null || expected === null) return;
  const facts = input.invocationState.facts(invocation);
  const factSummary = `${facts.complete ? "closed" : "open"}:${facts.candidates
    .map((fact) => factSpelling(context, fact))
    .toSorted()
    .join(";")}`;
  if (factSummary === expected) return;
  context.report({
    data: { actual: factSummary, expected },
    messageId: "unexpected",
    node: invocation,
  });
};

const argumentOriginSummary = (
  context: Context,
  input: {
    readonly invocation: ESTree.CallExpression | ESTree.NewExpression;
    readonly invocationState: ReturnType<typeof createCanonicalValueInvocationState>;
  },
): string => {
  const facts = input.invocationState.facts(input.invocation);
  const origins = facts.candidates.map((fact) => input.invocationState.argumentOrigins(fact, 0));
  const candidates = [
    ...new Set(
      origins.flatMap((set) =>
        set.candidates.map((origin) => candidateOriginSpelling(context, origin)),
      ),
    ),
  ].toSorted();
  const complete = facts.complete && origins.every((set) => set.complete);
  return `${complete ? "closed" : "open"}:${candidates.join(";")}`;
};

const inspectArgumentOrigin = (
  context: Context,
  input: {
    readonly invocationState: ReturnType<typeof createCanonicalValueInvocationState>;
    readonly node: ESTree.CallExpression;
  },
): void => {
  if (input.node.callee.type !== "Identifier" || input.node.callee.name !== "expectArgumentOrigin")
    return;
  const invocation = inspectedInvocation(input.node.arguments[0]);
  const expected = expectedSummary(input.node.arguments[1]);
  if (invocation === null || expected === null) return;
  const originSummary = argumentOriginSummary(context, {
    invocation,
    invocationState: input.invocationState,
  });
  if (originSummary === expected) return;
  context.report({
    data: { actual: originSummary, expected },
    messageId: "unexpected",
    node: invocation,
  });
};

export const invocationStateRule = createDontReviewItRule({
  name: "canonical-value-invocation",
  meta: {
    type: "problem",
    docs: { description: "Exercise canonical value invocation state", relatedGuidelines: [] },
    messages: { unexpected: "Expected {{expected}}, received {{actual}}." },
    schema: [],
  },
  create(context) {
    const bindingIndex = createCanonicalValueBindingIndex(context.sourceCode);
    const { invocationState } = createCanonicalValueRuntimeState(bindingIndex);
    return {
      AssignmentExpression: bindingIndex.recordAssignment,
      CallExpression: (node: ESTree.CallExpression) => {
        inspectArgumentOrigin(context, { invocationState, node });
        inspectFact(context, { invocationState, node });
        inspectInvocation(context, { invocationState, node });
      },
      VariableDeclarator: bindingIndex.recordVariableDeclarator,
    };
  },
});
