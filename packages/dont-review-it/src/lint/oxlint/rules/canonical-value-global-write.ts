import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueUnwrapAssignmentTarget } from "./canonical-value-binding-write-recorder.ts";
import { canonicalValueArgumentExpression } from "./canonical-value-call-arguments.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type { CanonicalValueExecutionIndex } from "./canonical-value-binding-execution.ts";
import type {
  CanonicalValueGlobalWrite,
  CanonicalValueIdentifier,
  CanonicalValueWriteOperator,
} from "./canonical-value-binding-types.ts";

type GlobalWriteRuntime = {
  readonly executionIndex: CanonicalValueExecutionIndex;
  readonly resolveIdentifier: (identifier: CanonicalValueIdentifier) => Variable | null;
};

type RuntimePath = readonly (string | null)[];

const staticNodeName = (property: ESTree.MemberExpression["property"]): string | null => {
  if (
    property.type === "Literal" &&
    (typeof property.value === "string" || typeof property.value === "number")
  ) {
    return String(property.value);
  }
  if (property.type !== "TemplateLiteral" || property.expressions.length !== 0) return null;
  return property.quasis[0]?.value.cooked ?? property.quasis[0]?.value.raw ?? null;
};

const staticMemberName = (member: ESTree.MemberExpression): string | null =>
  !member.computed && member.property.type === "Identifier"
    ? member.property.name
    : staticNodeName(member.property);

const globalIdentifierPath = (
  runtime: GlobalWriteRuntime,
  identifier: CanonicalValueIdentifier,
): RuntimePath | null => {
  const binding = runtime.resolveIdentifier(identifier);
  if (binding !== null && binding.defs.length !== 0) return null;
  return identifier.name === "globalThis" ? [] : [identifier.name];
};

const globalRuntimePath = (
  runtime: GlobalWriteRuntime,
  rawExpression: ESTree.Expression | CanonicalValueIdentifier,
): RuntimePath | null => {
  if (rawExpression.type === "Identifier") return globalIdentifierPath(runtime, rawExpression);
  const expression = unwrapExpression(rawExpression);
  if (expression.type !== "MemberExpression" || expression.object.type === "Super") return null;
  const base = globalRuntimePath(runtime, expression.object);
  return base === null ? null : [...base, staticMemberName(expression)];
};

const writeBase = (
  runtime: GlobalWriteRuntime,
  input: {
    readonly expression: ESTree.Expression;
    readonly node: ESTree.Node;
    readonly operator: CanonicalValueWriteOperator;
    readonly runtimePath: RuntimePath;
  },
): CanonicalValueGlobalWrite => ({
  executionContext: runtime.executionIndex.contextAt(input.node),
  expression: input.expression,
  guards: runtime.executionIndex.guardsAt(input.node),
  invocation: null,
  iteration: null,
  operator: input.operator,
  runtimePath: input.runtimePath,
  sourceContext: {
    cutoff: input.node.start,
    executionContext: runtime.executionIndex.contextAt(input.expression),
  },
  sourcePath: [],
  start: input.node.start,
});

const objectKeys = (expression: ESTree.Expression | null): readonly (string | null)[] | null => {
  const current = expression === null ? null : unwrapExpression(expression);
  if (current?.type !== "ObjectExpression") return null;
  return current.properties.flatMap((property) => {
    if (property.type === "SpreadElement") return [null];
    if (property.computed) {
      const key = property.key;
      if (
        key.type !== "Literal" ||
        (typeof key.value !== "string" && typeof key.value !== "number")
      ) {
        return [null];
      }
    }
    if (property.key.type === "Identifier") return [property.key.name];
    if (
      property.key.type === "Literal" &&
      (typeof property.key.value === "string" || typeof property.key.value === "number")
    ) {
      return [String(property.key.value)];
    }
    return [null];
  });
};

type PropertyMutationInput = {
  readonly call: ESTree.CallExpression;
  readonly method: string;
  readonly targetPath: RuntimePath;
};

const singlePropertyMutationPaths = (
  input: PropertyMutationInput,
): readonly RuntimePath[] | null => {
  const { call, method, targetPath } = input;
  if (
    method === "Object.defineProperty" ||
    method === "Object.deleteProperty" ||
    method === "Reflect.defineProperty" ||
    method === "Reflect.deleteProperty" ||
    method === "Reflect.set"
  ) {
    const key = canonicalValueArgumentExpression(call.arguments[1]);
    return [[...targetPath, key === null ? null : staticPropertyKey(key)]];
  }
  return method === "Object.setPrototypeOf" || method === "Reflect.setPrototypeOf"
    ? [[...targetPath, null]]
    : null;
};

const multiplePropertyMutationPaths = (
  input: PropertyMutationInput,
): readonly RuntimePath[] | null => {
  const { call, method, targetPath } = input;
  if (method === "Object.defineProperties") {
    const keys = objectKeys(canonicalValueArgumentExpression(call.arguments[1]));
    return (keys ?? [null]).map((key) => [...targetPath, key]);
  }
  if (method === "Object.assign") {
    return call.arguments.slice(1).flatMap((argument) => {
      const keys = objectKeys(canonicalValueArgumentExpression(argument));
      return (keys ?? [null]).map((key) => [...targetPath, key]);
    });
  }
  return null;
};

const propertyMutationPaths = (input: PropertyMutationInput): readonly RuntimePath[] =>
  singlePropertyMutationPaths(input) ?? multiplePropertyMutationPaths(input) ?? [];

const staticPropertyKey = (expression: ESTree.Expression): string | null => {
  const current = unwrapExpression(expression);
  if (
    current.type === "Literal" &&
    (typeof current.value === "string" || typeof current.value === "number")
  ) {
    return String(current.value);
  }
  if (current.type !== "TemplateLiteral" || current.expressions.length !== 0) return null;
  return current.quasis[0]?.value.cooked ?? current.quasis[0]?.value.raw ?? null;
};

const callMutationPaths = (
  runtime: GlobalWriteRuntime,
  call: ESTree.CallExpression,
): readonly RuntimePath[] => {
  const callee = call.callee.type === "Super" ? null : globalRuntimePath(runtime, call.callee);
  if (callee === null || callee.some((segment) => segment === null)) return [];
  const target = canonicalValueArgumentExpression(call.arguments[0]);
  if (target === null) return callee.length === 2 ? [[null]] : [];
  const targetPath = globalRuntimePath(runtime, target);
  if (targetPath === null) return [];
  return propertyMutationPaths({ call, method: callee.join("."), targetPath });
};

export const createCanonicalValueGlobalWriteIndex = (runtime: GlobalWriteRuntime) => {
  const writes = new Set<CanonicalValueGlobalWrite>();
  const recordTarget = (input: {
    readonly expression: ESTree.Expression;
    readonly node: ESTree.Node;
    readonly operator: CanonicalValueWriteOperator;
    readonly target: ESTree.Node;
  }): void => {
    const target = canonicalValueUnwrapAssignmentTarget(input.target);
    if (target.type !== "Identifier" && target.type !== "MemberExpression") return;
    const runtimePath = globalRuntimePath(runtime, target);
    if (runtimePath === null) return;
    writes.add(writeBase(runtime, { ...input, runtimePath }));
  };
  return {
    recordAssignment: (node: ESTree.AssignmentExpression) => {
      recordTarget({ expression: node.right, node, operator: node.operator, target: node.left });
    },
    recordCall: (node: ESTree.CallExpression) => {
      callMutationPaths(runtime, node).forEach((runtimePath) => {
        writes.add(writeBase(runtime, { expression: node, node, operator: "update", runtimePath }));
      });
    },
    recordUnary: (node: ESTree.UnaryExpression) => {
      if (node.operator === "delete") {
        recordTarget({
          expression: node.argument,
          node,
          operator: "delete",
          target: node.argument,
        });
      }
    },
    recordUpdate: (node: ESTree.UpdateExpression) => {
      recordTarget({ expression: node.argument, node, operator: "update", target: node.argument });
    },
    writes: (): readonly CanonicalValueGlobalWrite[] => [...writes],
  };
};
