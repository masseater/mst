import {
  type CanonicalValueBindingWrite,
  type CanonicalValueExecutionContext,
  type CanonicalValueIdentifier,
  type CanonicalValueIndexedPropertyPath,
  type CanonicalValueMemberWrite,
  type CanonicalValueSourcePath,
  type CanonicalValueSourcePathSegment,
  type CanonicalValueWriteBase,
  type CanonicalValueWriteOperator,
} from "./canonical-value-binding-types.ts";
import { canonicalValuePropertyKeyOf } from "./canonical-value-property-key.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type { CanonicalValueExecutionIndex } from "./canonical-value-binding-execution.ts";

type WriteRecorderRuntime = {
  readonly bindingWrites: Map<Variable, readonly CanonicalValueBindingWrite[]>;
  readonly executionIndex: CanonicalValueExecutionIndex;
  readonly memberWrites: Map<Variable, readonly CanonicalValueMemberWrite[]>;
  readonly resolveIdentifier: (identifier: CanonicalValueIdentifier) => Variable | null;
};

export type CanonicalValueRecordTargetInput = {
  readonly expression: ESTree.Expression;
  readonly invocation?: ESTree.Node;
  readonly iteration?: ESTree.ForInStatement | ESTree.ForOfStatement;
  readonly operator: CanonicalValueWriteOperator;
  readonly sourceContext?: {
    readonly cutoff: number;
    readonly executionContext: CanonicalValueExecutionContext;
  };
  readonly sourcePath: CanonicalValueSourcePath;
  readonly start: number;
  readonly target: ESTree.Node;
};

export const canonicalValueUnwrapAssignmentTarget = (target: ESTree.Node): ESTree.Node => {
  if (
    target.type === "TSAsExpression" ||
    target.type === "TSNonNullExpression" ||
    target.type === "TSSatisfiesExpression" ||
    target.type === "TSTypeAssertion"
  ) {
    return canonicalValueUnwrapAssignmentTarget(target.expression);
  }
  return target.type === "ChainExpression"
    ? canonicalValueUnwrapAssignmentTarget(target.expression)
    : target;
};

const memberRoot = (
  node: ESTree.Node,
  path: CanonicalValueIndexedPropertyPath,
): {
  readonly identifier: CanonicalValueIdentifier;
  readonly path: CanonicalValueIndexedPropertyPath;
} | null => {
  const target = canonicalValueUnwrapAssignmentTarget(node);
  if (target.type === "Identifier") return { identifier: target, path };
  if (target.type !== "MemberExpression") return null;
  return memberRoot(target.object, [
    canonicalValuePropertyKeyOf(target.property, target.computed),
    ...path,
  ]);
};

const writeBase = (
  runtime: WriteRecorderRuntime,
  input: CanonicalValueRecordTargetInput,
): CanonicalValueWriteBase => {
  const executionContext = runtime.executionIndex.contextAt(input.target);
  return {
    executionContext,
    expression: input.expression,
    guards: runtime.executionIndex.guardsAt(input.target),
    invocation: input.invocation ?? null,
    iteration: input.iteration ?? null,
    operator: input.operator,
    sourceContext: input.sourceContext ?? {
      cutoff: input.start,
      executionContext: runtime.executionIndex.contextAt(input.expression),
    },
    sourcePath: input.sourcePath,
    start: input.start,
  };
};

const recordIdentifier = (
  runtime: WriteRecorderRuntime,
  input: CanonicalValueRecordTargetInput,
): void => {
  if (input.target.type !== "Identifier") return;
  const binding = runtime.resolveIdentifier(input.target);
  if (binding === null) return;
  const write = { ...writeBase(runtime, input), binding, target: input.target };
  const existing = runtime.bindingWrites.get(binding) ?? [];
  const duplicate = existing.some(
    (candidate) =>
      candidate.expression === write.expression &&
      candidate.invocation === write.invocation &&
      candidate.operator === write.operator &&
      candidate.start === write.start &&
      candidate.target === write.target,
  );
  if (!duplicate) runtime.bindingWrites.set(binding, [...existing, write]);
};

const recordMember = (
  runtime: WriteRecorderRuntime,
  input: CanonicalValueRecordTargetInput,
): void => {
  if (input.target.type !== "MemberExpression") return;
  const root = memberRoot(input.target, []);
  if (root === null) return;
  const binding = runtime.resolveIdentifier(root.identifier);
  if (binding === null) return;
  const write = {
    ...writeBase(runtime, input),
    binding,
    target: input.target,
    targetPath: root.path,
  };
  runtime.memberWrites.set(binding, [...(runtime.memberWrites.get(binding) ?? []), write]);
};

const recordDefaultTarget = (
  runtime: WriteRecorderRuntime,
  input: CanonicalValueRecordTargetInput,
): void => {
  if (input.target.type !== "AssignmentPattern") return;
  recordCanonicalValueTarget(runtime, {
    ...input,
    sourcePath: [...input.sourcePath, { expression: input.target.right, kind: "default" }],
    target: input.target.left,
  });
};

const recordArrayTarget = (
  runtime: WriteRecorderRuntime,
  input: CanonicalValueRecordTargetInput,
): void => {
  if (input.target.type !== "ArrayPattern") return;
  input.target.elements.forEach((element, index) => {
    if (element === null) return;
    const segment: CanonicalValueSourcePathSegment =
      element.type === "RestElement"
        ? { kind: "array-rest", startIndex: index }
        : { index, kind: "array-index" };
    recordCanonicalValueTarget(runtime, {
      ...input,
      sourcePath: [...input.sourcePath, segment],
      target: element.type === "RestElement" ? element.argument : element,
    });
  });
};

const recordObjectTarget = (
  runtime: WriteRecorderRuntime,
  input: CanonicalValueRecordTargetInput,
): void => {
  if (input.target.type !== "ObjectPattern") return;
  const excludedKeys = input.target.properties
    .filter((property) => property.type === "Property")
    .map((property) => canonicalValuePropertyKeyOf(property.key, property.computed));
  input.target.properties.forEach((property) => {
    const target = property.type === "RestElement" ? property.argument : property.value;
    const segment: CanonicalValueSourcePathSegment =
      property.type === "RestElement"
        ? { excludedKeys, kind: "object-rest" }
        : {
            key: canonicalValuePropertyKeyOf(property.key, property.computed),
            kind: "property",
          };
    recordCanonicalValueTarget(runtime, {
      ...input,
      sourcePath: [...input.sourcePath, segment],
      target,
    });
  });
};

export const recordCanonicalValueTarget = (
  runtime: WriteRecorderRuntime,
  rawInput: CanonicalValueRecordTargetInput,
): void => {
  const input = {
    ...rawInput,
    target: canonicalValueUnwrapAssignmentTarget(rawInput.target),
  };
  if (input.target.type === "Identifier") recordIdentifier(runtime, input);
  else if (input.target.type === "MemberExpression") recordMember(runtime, input);
  else if (input.target.type === "AssignmentPattern") recordDefaultTarget(runtime, input);
  else if (input.target.type === "ArrayPattern") recordArrayTarget(runtime, input);
  else if (input.target.type === "ObjectPattern") recordObjectTarget(runtime, input);
};
