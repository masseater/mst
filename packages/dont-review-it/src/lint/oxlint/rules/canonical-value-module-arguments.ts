import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { bindingInScope } from "./scope-resolution.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type { ModuleLoaderInvocation } from "./canonical-value-module-loader-fact.ts";
import type { CanonicalValueModuleResolution } from "./canonical-value-module-resolution.ts";

const expressionsFromIdentifierAt = (
  resolution: CanonicalValueModuleResolution,
  input: { readonly identifier: ESTree.IdentifierReference; readonly index: number },
): readonly ESTree.Expression[] => {
  const binding = bindingInScope(
    resolution.context.sourceCode.getScope(input.identifier),
    input.identifier.name,
  );
  if (binding === null || resolution.seen.has(binding)) return [];
  const next = { ...resolution, seen: new Set<Variable>([...resolution.seen, binding]) };
  return binding.defs.flatMap((definition) => {
    const node = definition.node;
    return node.type === "VariableDeclarator" && node.init !== null
      ? expressionsInArrayAt(next, { expression: node.init, index: input.index })
      : [];
  });
};

const expressionsFromArrayAt = (
  resolution: CanonicalValueModuleResolution,
  input: { readonly expression: ESTree.ArrayExpression; readonly index: number },
): readonly ESTree.Expression[] => {
  const element = input.expression.elements[input.index];
  if (element === null || element === undefined) return [];
  return element.type === "SpreadElement"
    ? expressionsInArrayAt(resolution, { expression: element.argument, index: 0 })
    : [element];
};

const expressionsInArrayAt = (
  resolution: CanonicalValueModuleResolution,
  input: { readonly expression: ESTree.Expression; readonly index: number },
): readonly ESTree.Expression[] => {
  const unwrapped = unwrapExpression(input.expression);
  const resolved = resolution.propertyState
    .origins({ cutoff: resolution.cutoff, expression: unwrapped, path: [String(input.index)] })
    .candidates.flatMap((origin) =>
      origin.kind === "expression" && origin.projections.length === 0 ? [origin.expression] : [],
    );
  if (unwrapped.type === "ConditionalExpression") {
    return uniqBy(
      [
        ...resolved,
        ...expressionsInArrayAt(resolution, {
          expression: unwrapped.consequent,
          index: input.index,
        }),
        ...expressionsInArrayAt(resolution, {
          expression: unwrapped.alternate,
          index: input.index,
        }),
      ],
      (candidate) => `${candidate.start}:${candidate.end}`,
    );
  }
  if (unwrapped.type === "Identifier") {
    return uniqBy(
      [
        ...resolved,
        ...expressionsFromIdentifierAt(resolution, {
          identifier: unwrapped,
          index: input.index,
        }),
      ],
      (candidate) => `${candidate.start}:${candidate.end}`,
    );
  }
  return uniqBy(
    [
      ...resolved,
      ...(unwrapped.type === "ArrayExpression"
        ? expressionsFromArrayAt(resolution, {
            expression: unwrapped,
            index: input.index,
          })
        : []),
    ],
    (candidate) => `${candidate.start}:${candidate.end}`,
  );
};

export const canonicalValueModuleArrayExpressionsAt = (
  resolution: CanonicalValueModuleResolution,
  input: { readonly expression: ESTree.Expression; readonly index: number },
): readonly ESTree.Expression[] => expressionsInArrayAt(resolution, input);

export const canonicalValueModuleInvocationArgumentsAt = (
  resolution: CanonicalValueModuleResolution,
  input: { readonly index: number; readonly invocation: ModuleLoaderInvocation },
): readonly ESTree.Expression[] => {
  if (input.invocation.argumentArray !== null) {
    return expressionsInArrayAt(resolution, {
      expression: input.invocation.argumentArray,
      index: input.index,
    });
  }
  const argument = input.invocation.directArguments?.[input.index];
  if (argument === undefined) return [];
  return argument.type === "SpreadElement"
    ? expressionsInArrayAt(resolution, { expression: argument.argument, index: 0 })
    : [argument];
};
