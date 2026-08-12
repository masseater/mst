import {
  closedCandidateSet,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapType } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  type CanonicalValuePrimitiveTypeEnvironment,
  type CanonicalValuePrimitiveTypeResolution,
} from "./canonical-value-primitive-type-context.ts";
import { resolveCanonicalValuePrimitiveTypeReference } from "./canonical-value-primitive-type-reference.ts";

import type { ESTree } from "@oxlint/plugins";

export type CanonicalValuePrimitiveCallable = {
  readonly node: ESTree.Function | ESTree.TSConstructorType | ESTree.TSFunctionType;
  readonly substitutions: ReadonlyMap<string, ESTree.TSType>;
};

const callableKey = (callable: CanonicalValuePrimitiveCallable): string =>
  `${callable.node.start}:${callable.node.end}`;

const directCallable = (
  type: ESTree.TSType,
  substitutions: ReadonlyMap<string, ESTree.TSType>,
): CandidateSet<CanonicalValuePrimitiveCallable> | null =>
  type.type === "TSFunctionType" || type.type === "TSConstructorType"
    ? closedCandidateSet([{ node: type, substitutions }], callableKey)
    : null;

const functionDefinition = (node: ESTree.Node): ESTree.Function | null =>
  node.type === "FunctionDeclaration" ||
  node.type === "FunctionExpression" ||
  node.type === "TSDeclareFunction" ||
  node.type === "TSEmptyBodyFunctionExpression"
    ? node
    : null;

const queryCallables = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & { readonly type: ESTree.TSTypeQuery },
): CandidateSet<CanonicalValuePrimitiveCallable> | null => {
  if (input.type.exprName.type !== "Identifier") return null;
  const binding = environment.bindingIndex.resolveIdentifier(input.type.exprName);
  if (binding === null) return null;
  const definitions = environment.bindingIndex.definitionsOf(binding);
  const callables = definitions.flatMap((definition) => {
    const node = functionDefinition(definition.node);
    return node === null ? [] : [{ node, substitutions: input.substitutions }];
  });
  if (callables.length === 0) return null;
  return callables.length === definitions.length
    ? closedCandidateSet(callables, callableKey)
    : openCandidateSet(callables, callableKey);
};

const referenceCallables = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & { readonly type: ESTree.TSTypeReference },
): CandidateSet<CanonicalValuePrimitiveCallable> | null => {
  const referenced = resolveCanonicalValuePrimitiveTypeReference(environment, input);
  return referenced === null ? null : resolveCallables(environment, referenced);
};

const resolveCallables = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  rawInput: CanonicalValuePrimitiveTypeResolution,
): CandidateSet<CanonicalValuePrimitiveCallable> | null => {
  const type = unwrapType(rawInput.type);
  if (rawInput.seenTypes.has(type)) return null;
  const input = {
    ...rawInput,
    seenTypes: new Set([...rawInput.seenTypes, type]),
    type,
  };
  return (
    directCallable(type, input.substitutions) ??
    (type.type === "TSTypeQuery" ? queryCallables(environment, { ...input, type }) : null) ??
    (type.type === "TSTypeReference" ? referenceCallables(environment, { ...input, type }) : null)
  );
};

export const resolveCanonicalValuePrimitiveCallables = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & { readonly type: ESTree.TSType },
): CandidateSet<CanonicalValuePrimitiveCallable> | null => resolveCallables(environment, input);

export const canonicalValueCallableParameterType = (
  callable: CanonicalValuePrimitiveCallable,
  index: number,
): ESTree.TSType | null => {
  const parameter = callable.node.params[index];
  if (parameter === undefined) return null;
  const pattern = parameter.type === "TSParameterProperty" ? parameter.parameter : parameter;
  return pattern.typeAnnotation?.typeAnnotation ?? null;
};

export const canonicalValueCallableReturnType = (
  callable: CanonicalValuePrimitiveCallable,
): ESTree.TSType | null => callable.node.returnType?.typeAnnotation ?? null;
