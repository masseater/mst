import { resolveBinding, type BindingResolution } from "./resolved-bindings.ts";
import { WIDENED_TYPE_NODES } from "./widened-type-nodes.ts";

import type { Definition, ESTree } from "@oxlint/plugins";

const PROMISE_TYPE_NAMES: ReadonlySet<string> = new Set(["Promise", "PromiseLike", "Thenable"]);

const PROMISE_GLOBAL_NAME = "Promise";

const PROMISE_PRODUCING_STATIC_MEMBERS: ReadonlySet<string> = new Set([
  "all",
  "allSettled",
  "any",
  "race",
  "reject",
  "resolve",
  "try",
]);

export type CallSignature = {
  readonly asyncFunction: boolean;
  readonly parameters: readonly ESTree.ParamPattern[];
  readonly returnType: ESTree.TSType | null;
};

type DeclaredValue = {
  readonly valueType: ESTree.TSType | null;
  readonly named: ESTree.Function | ESTree.ArrowFunctionExpression | null;
  readonly widenedType: boolean;
  readonly initialiser: ESTree.Expression | null;
};

const UNDECLARED: DeclaredValue = {
  valueType: null,
  named: null,
  widenedType: false,
  initialiser: null,
};

export const carriedThroughExpression = (node: ESTree.Expression): ESTree.Expression => {
  if (
    node.type === "ChainExpression" ||
    node.type === "ParenthesizedExpression" ||
    node.type === "TSInstantiationExpression" ||
    node.type === "TSNonNullExpression"
  ) {
    return carriedThroughExpression(node.expression);
  }
  return node;
};

export const isPromiseType = (node: ESTree.TSType): boolean => {
  if (node.type === "TSTypeReference") {
    return node.typeName.type === "Identifier" && PROMISE_TYPE_NAMES.has(node.typeName.name);
  }
  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    return node.types.some(isPromiseType);
  }
  return false;
};

const functionTypeOf = (node: ESTree.TSType): ESTree.TSFunctionType | null =>
  node.type === "TSFunctionType" ? node : null;

const annotatedValue = (definition: Definition): DeclaredValue => {
  const annotation = definition.name.typeAnnotation?.typeAnnotation ?? null;
  return {
    valueType: annotation,
    named: null,
    widenedType: annotation !== null && WIDENED_TYPE_NODES.has(annotation.type),
    initialiser: null,
  };
};

const initialisedValue = ({
  declarator,
  annotated,
  lookup,
}: {
  readonly declarator: ESTree.VariableDeclarator;
  readonly annotated: DeclaredValue;
  readonly lookup: BindingResolution;
}): DeclaredValue => {
  const { init } = declarator;
  const initialised = init === null ? UNDECLARED : declaredValueOf(init, lookup);
  return {
    valueType: annotated.valueType ?? initialised.valueType,
    named: initialised.named,
    widenedType: annotated.widenedType || initialised.widenedType,
    initialiser: init,
  };
};

const declaredValueOfDefinition = (
  definition: Definition,
  lookup: BindingResolution,
): DeclaredValue => {
  const annotated = annotatedValue(definition);
  if (definition.type === "FunctionName") {
    return { ...annotated, named: definition.node as ESTree.Function };
  }
  if (definition.type === "Variable" && definition.node.type === "VariableDeclarator") {
    return initialisedValue({ declarator: definition.node, annotated, lookup });
  }
  return annotated;
};

const declaredValueOfBinding = (
  node: ESTree.IdentifierReference,
  { scopeAt, seenBindings }: BindingResolution,
): DeclaredValue => {
  const binding = resolveBinding(scopeAt(node), node.name);
  if (binding === null || seenBindings.has(binding)) return UNDECLARED;

  const [definition] = binding.defs;
  if (definition === undefined) return UNDECLARED;

  return declaredValueOfDefinition(definition, {
    scopeAt,
    seenBindings: new Set([...seenBindings, binding]),
  });
};

const assertedValueOf = (
  node: ESTree.TSAsExpression | ESTree.TSSatisfiesExpression | ESTree.TSTypeAssertion,
  lookup: BindingResolution,
): DeclaredValue => {
  const inner = declaredValueOf(node.expression, lookup);
  return WIDENED_TYPE_NODES.has(node.typeAnnotation.type)
    ? { ...inner, widenedType: true }
    : { ...inner, valueType: node.typeAnnotation };
};

const declaredValueOf = (node: ESTree.Expression, lookup: BindingResolution): DeclaredValue => {
  const carried = carriedThroughExpression(node);

  if (carried.type === "ArrowFunctionExpression" || carried.type === "FunctionExpression") {
    return { ...UNDECLARED, named: carried };
  }
  if (
    carried.type === "TSAsExpression" ||
    carried.type === "TSSatisfiesExpression" ||
    carried.type === "TSTypeAssertion"
  ) {
    return assertedValueOf(carried, lookup);
  }
  return carried.type === "Identifier" ? declaredValueOfBinding(carried, lookup) : UNDECLARED;
};

const callSignatureOfDeclared = (declared: DeclaredValue): CallSignature | null => {
  if (declared.named !== null) {
    return {
      asyncFunction: declared.named.async,
      parameters: declared.named.params,
      returnType: declared.named.returnType?.typeAnnotation ?? null,
    };
  }

  const declaredType = declared.valueType === null ? null : functionTypeOf(declared.valueType);
  return declaredType === null
    ? null
    : {
        asyncFunction: false,
        parameters: declaredType.params,
        returnType: declaredType.returnType.typeAnnotation,
      };
};

export const callSignatureOf = (
  node: ESTree.Expression,
  lookup: BindingResolution,
): CallSignature | null => callSignatureOfDeclared(declaredValueOf(node, lookup));

const yieldsPromise = (signature: CallSignature | null): boolean =>
  signature !== null &&
  (signature.asyncFunction ||
    (signature.returnType !== null && isPromiseType(signature.returnType)));

export const isPromiseYieldingCallee = (
  node: ESTree.Expression,
  lookup: BindingResolution,
): boolean => yieldsPromise(callSignatureOf(node, lookup));

const isPromiseGlobal = (node: ESTree.Expression): boolean => {
  const carried = carriedThroughExpression(node);
  return carried.type === "Identifier" && carried.name === PROMISE_GLOBAL_NAME;
};

const isPromiseStaticCall = (node: ESTree.CallExpression): boolean => {
  const callee = carriedThroughExpression(node.callee);
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  if (callee.property.type !== "Identifier") return false;
  if (!PROMISE_PRODUCING_STATIC_MEMBERS.has(callee.property.name)) return false;
  return isPromiseGlobal(callee.object);
};

export const isPromiseValuedCall = (
  node: ESTree.Expression,
  lookup: BindingResolution,
): boolean => {
  if (node.type === "NewExpression") return isPromiseGlobal(node.callee);
  if (node.type !== "CallExpression") return false;
  if (isPromiseStaticCall(node)) return true;
  return isPromiseYieldingCallee(node.callee, lookup);
};

export const isPromiseValuedExpression = (
  node: ESTree.Expression,
  lookup: BindingResolution,
): boolean => {
  const carried = carriedThroughExpression(node);
  if (isPromiseValuedCall(carried, lookup)) return true;
  if (carried.type === "AwaitExpression") return false;

  const declared = declaredValueOf(carried, lookup);
  if (declared.valueType !== null) return isPromiseType(declared.valueType);
  return (
    declared.initialiser !== null &&
    isPromiseValuedCall(carriedThroughExpression(declared.initialiser), lookup)
  );
};

export const isWidenedAsyncCall = (
  node: ESTree.CallExpression,
  lookup: BindingResolution,
): boolean => {
  const declared = declaredValueOf(node.callee, lookup);
  return declared.widenedType && yieldsPromise(callSignatureOfDeclared(declared));
};

export const synchronousReturnOfParameter = (
  signature: CallSignature,
  index: number,
): ESTree.TSType | null => {
  const parameter = signature.parameters[index];
  if (parameter === undefined || parameter.type === "TSParameterProperty") return null;

  const annotation = parameter.typeAnnotation?.typeAnnotation ?? null;
  const declaredType = annotation === null ? null : functionTypeOf(annotation);
  if (declaredType === null) return null;

  const declaredReturn = declaredType.returnType.typeAnnotation;
  if (WIDENED_TYPE_NODES.has(declaredReturn.type)) return null;
  return isPromiseType(declaredReturn) ? null : declaredReturn;
};
