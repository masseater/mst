import { dirname, resolve } from "node:path";

import { cartesianProduct, uniqBy } from "es-toolkit";

import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import {
  canonicalValueImportedRouteCallableName,
  canonicalValueImportedRouteFromOrigin,
} from "./canonical-value-route-origin.ts";
import { CANONICAL_VALUE_PATH_MODULE_SPECIFIERS } from "./canonical-value-static-path.ts";

import type { Context, ESTree } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type {
  CanonicalValueInvocationFact,
  CanonicalValueInvocationState,
} from "./canonical-value-invocation.ts";
import type { CanonicalValueModuleSpecifier } from "./canonical-value-module-specifier.ts";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

type PathSpecifierEnvironment = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly context: Context;
  readonly invocationState: CanonicalValueInvocationState;
  readonly propertyState: CanonicalValuePropertyState;
};

const isImportMetaDirnameOrigin = (origin: CanonicalValueOrigin): boolean => {
  if (origin.kind === "absent" || origin.expression.type !== "MetaProperty") return false;
  if (origin.expression.meta.name !== "import" || origin.expression.property.name !== "meta") {
    return false;
  }
  const path = canonicalValueInvocationPropertyPath(origin);
  return path?.length === 1 && path[0] === "dirname";
};

const isImportMetaDirname = (
  environment: PathSpecifierEnvironment,
  expression: ESTree.Expression,
): boolean =>
  environment.propertyState.origins({ expression }).candidates.some(isImportMetaDirnameOrigin);

const argumentStrings = (
  environment: PathSpecifierEnvironment,
  argument: ESTree.Argument,
): readonly string[] => {
  if (argument.type === "SpreadElement") return [];
  if (isImportMetaDirname(environment, argument)) return [dirname(environment.context.filename)];
  return environment.propertyState
    .primitives({ expression: argument })
    .candidates.flatMap((primitive) => (typeof primitive === "string" ? [primitive] : []));
};

const directArguments = (fact: CanonicalValueInvocationFact): readonly ESTree.Argument[] | null => {
  if (!fact.argumentSegments.every((segment) => segment.kind === "direct")) return null;
  return fact.argumentSegments.flatMap((segment) => segment.elements);
};

const resolvedPaths = (
  environment: PathSpecifierEnvironment,
  fact: CanonicalValueInvocationFact,
): readonly string[] => {
  const arguments_ = directArguments(fact);
  if (arguments_ === null) return [];
  const vectors = cartesianProduct(
    ...arguments_.map((argument) => argumentStrings(environment, argument)),
  );
  return vectors.map((vector) => resolve(...vector));
};

const isPathResolveFact = (
  environment: PathSpecifierEnvironment,
  fact: CanonicalValueInvocationFact,
): boolean => {
  const route = canonicalValueImportedRouteFromOrigin(fact.target, environment.bindingIndex);
  return (
    route !== null &&
    CANONICAL_VALUE_PATH_MODULE_SPECIFIERS.has(route.specifier) &&
    canonicalValueImportedRouteCallableName(route) === "resolve"
  );
};

export const canonicalValuePathModuleSpecifiers = (
  environment: PathSpecifierEnvironment,
  expression: ESTree.CallExpression,
): readonly CanonicalValueModuleSpecifier[] =>
  uniqBy(
    environment.invocationState
      .facts(expression)
      .candidates.filter((fact) => isPathResolveFact(environment, fact))
      .flatMap((fact) => resolvedPaths(environment, fact))
      .map((value) => ({ node: expression, value })),
    (specifier) => specifier.value,
  );
