import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueModuleResolverArguments } from "./canonical-value-module-loader.ts";
import { canonicalValuePathModuleSpecifiers } from "./canonical-value-path-module-specifier.ts";
import { canonicalValueUrlModuleSpecifiers } from "./canonical-value-url-module-specifier.ts";

import type { Context, ESTree } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValueInvocationState } from "./canonical-value-invocation.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

export type CanonicalValueModuleSpecifier = {
  readonly node: ESTree.Node;
  readonly value: string;
};

const moduleSpecifiers = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly context: Context;
  readonly expression: ESTree.Expression;
  readonly invocationState: CanonicalValueInvocationState;
  readonly propertyState: CanonicalValuePropertyState;
  readonly seen: ReadonlySet<ESTree.Expression>;
}): readonly CanonicalValueModuleSpecifier[] => {
  const expression = unwrapExpression(input.expression);
  if (input.seen.has(expression)) return [];
  const next = new Set([...input.seen, expression]);
  const direct = input.propertyState
    .primitives({ expression })
    .candidates.flatMap((value) =>
      typeof value === "string" ? [{ node: expression, value }] : [],
    );
  const url = canonicalValueUrlModuleSpecifiers(input, expression);
  const path =
    expression.type === "CallExpression"
      ? canonicalValuePathModuleSpecifiers(input, expression)
      : [];
  const originated = input.propertyState
    .origins({ expression })
    .candidates.flatMap((origin) =>
      origin.kind === "expression" &&
      origin.expression !== expression &&
      origin.projections.length === 0
        ? moduleSpecifiers({ ...input, expression: origin.expression, seen: next })
        : [],
    )
    .map((specifier) => ({ ...specifier, node: expression }));
  const resolved =
    expression.type === "CallExpression"
      ? canonicalValueModuleResolverArguments({
          context: input.context,
          invocation: expression,
          propertyState: input.propertyState,
        })
          .flatMap((argument) => moduleSpecifiers({ ...input, expression: argument, seen: next }))
          .map((specifier) => ({ ...specifier, node: expression }))
      : [];
  const returned =
    expression.type === "CallExpression" || expression.type === "NewExpression"
      ? input.bindingIndex
          .callReturnResults(expression)
          .flatMap((result) => moduleSpecifiers({ ...input, expression: result, seen: next }))
          .map((specifier) => ({ ...specifier, node: expression }))
      : [];
  return uniqBy(
    [...direct, ...url, ...path, ...originated, ...resolved, ...returned],
    (specifier) => specifier.value,
  );
};

export const canonicalValueModuleSpecifiers = (
  input: {
    readonly bindingIndex: CanonicalValueBindingIndex;
    readonly context: Context;
    readonly invocationState: CanonicalValueInvocationState;
    readonly propertyState: CanonicalValuePropertyState;
  },
  expression: ESTree.Expression,
): readonly CanonicalValueModuleSpecifier[] =>
  moduleSpecifiers({ ...input, expression, seen: new Set() });
