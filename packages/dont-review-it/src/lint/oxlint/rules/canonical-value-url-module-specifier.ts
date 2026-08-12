import { propertyKeyName, unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import {
  canonicalValueImportedRouteCallableName,
  canonicalValueImportedRouteFromOrigin,
} from "./canonical-value-route-origin.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValueModuleSpecifier } from "./canonical-value-module-specifier.ts";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

type UrlSpecifierEnvironment = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly propertyState: CanonicalValuePropertyState;
};

const URL_MODULE_SPECIFIERS: ReadonlySet<string> = new Set(["node:url", "url"]);

const isGlobalUrlConstructor = (
  environment: UrlSpecifierEnvironment,
  expression: ESTree.Expression,
): boolean =>
  environment.propertyState.origins({ expression }).candidates.some((origin) => {
    if (origin.kind === "absent") return false;
    const path = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
      name: "URL",
      origin,
    });
    return path?.length === 0;
  });

const isImportMetaUrlOrigin = (origin: CanonicalValueOrigin): boolean => {
  if (origin.kind === "absent" || origin.expression.type !== "MetaProperty") return false;
  if (origin.expression.meta.name !== "import" || origin.expression.property.name !== "meta") {
    return false;
  }
  const path = canonicalValueInvocationPropertyPath(origin);
  return path?.length === 1 && path[0] === "url";
};

const isImportMetaUrl = (
  environment: UrlSpecifierEnvironment,
  expression: ESTree.Expression,
): boolean =>
  environment.propertyState.origins({ expression }).candidates.some(isImportMetaUrlOrigin);

const isFileUrlToPath = (
  environment: UrlSpecifierEnvironment,
  expression: ESTree.Expression,
): boolean =>
  environment.propertyState.origins({ expression }).candidates.some((origin) => {
    const route = canonicalValueImportedRouteFromOrigin(origin, environment.bindingIndex);
    if (route === null || !URL_MODULE_SPECIFIERS.has(route.specifier)) return false;
    return canonicalValueImportedRouteCallableName(route) === "fileURLToPath";
  });

const calledUrlExpression = (
  environment: UrlSpecifierEnvironment,
  expression: ESTree.CallExpression,
): ESTree.Expression | null => {
  const callee = unwrapExpression(expression.callee);
  if (callee.type === "MemberExpression" && callee.object.type !== "Super") {
    const method =
      callee.property.type === "PrivateIdentifier" ? null : propertyKeyName(callee.property);
    if (method === "toString") return callee.object;
  }
  const argument = expression.arguments[0];
  return isFileUrlToPath(environment, callee) &&
    argument !== undefined &&
    argument.type !== "SpreadElement"
    ? argument
    : null;
};

const wrappedUrlExpression = (
  environment: UrlSpecifierEnvironment,
  rawExpression: ESTree.Expression,
): ESTree.Expression => {
  const expression = unwrapExpression(rawExpression);
  if (expression.type === "CallExpression") {
    return calledUrlExpression(environment, expression) ?? expression;
  }
  if (
    expression.type === "MemberExpression" &&
    expression.object.type !== "Super" &&
    expression.property.type === "Identifier" &&
    expression.property.name === "href"
  ) {
    return expression.object;
  }
  return expression;
};

const originatedUrlExpression = (
  environment: UrlSpecifierEnvironment,
  expression: ESTree.Expression,
): ESTree.Expression | null => {
  const origin = environment.propertyState.origins({ expression }).candidates.find((candidate) => {
    if (candidate.kind === "absent" || candidate.expression.type !== "NewExpression") return false;
    const path = canonicalValueInvocationPropertyPath(candidate);
    return path?.length === 1 && path[0] === "href";
  });
  return origin?.kind === "expression" ? origin.expression : null;
};

export const canonicalValueUrlModuleSpecifiers = (
  environment: UrlSpecifierEnvironment,
  rawExpression: ESTree.Expression,
): readonly CanonicalValueModuleSpecifier[] => {
  const wrapped = unwrapExpression(wrappedUrlExpression(environment, rawExpression));
  const expression =
    wrapped.type === "NewExpression"
      ? wrapped
      : (originatedUrlExpression(environment, wrapped) ?? wrapped);
  if (expression.type !== "NewExpression") return [];
  if (!isGlobalUrlConstructor(environment, expression.callee)) return [];
  const [relativeArgument, baseArgument] = expression.arguments;
  if (
    relativeArgument === undefined ||
    relativeArgument.type === "SpreadElement" ||
    baseArgument === undefined ||
    baseArgument.type === "SpreadElement" ||
    !isImportMetaUrl(environment, baseArgument)
  ) {
    return [];
  }
  return environment.propertyState
    .primitives({ expression: relativeArgument })
    .candidates.map((value) => ({ node: rawExpression, value: String(value) }));
};
