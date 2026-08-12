import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  combineCanonicalValueCallbackArguments,
  canonicalValueCallbackAliasExpressions,
  canonicalValueElementCallbackArguments,
  canonicalValueUnknownCallbackArguments,
  type CanonicalValueCallbackArguments,
  type CanonicalValueCallbackRuntime,
} from "./canonical-value-binding-callback-argument-set.ts";
import { canonicalValueForOfSources } from "./canonical-value-binding-iteration.ts";
import { canonicalValueObjectEnumerationCallbackArguments } from "./canonical-value-binding-object-enumeration-callback.ts";
import {
  canonicalValueArgumentExpression,
  type CanonicalValueCallArgumentSource,
} from "./canonical-value-call-arguments.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";

import type { ESTree } from "@oxlint/plugins";

const presentArraySources = (
  input: CanonicalValueCallbackRuntime,
  expression: ESTree.ArrayExpression,
): readonly CanonicalValueCallArgumentSource[] =>
  expression.elements.flatMap((element) => {
    if (element === null) return [];
    if (element.type !== "SpreadElement") return [{ expression: element, sourcePath: [] }];
    return canonicalValueForOfSources({
      resolveAlias: (identifier) => canonicalValueCallbackAliasExpressions(input, identifier),
      source: element.argument,
    });
  });

const arrayCallbackArguments = (
  input: CanonicalValueCallbackRuntime & {
    readonly expression: ESTree.ArrayExpression;
    readonly skipArrayHoles: boolean;
  },
): CanonicalValueCallbackArguments => ({
  arguments: (input.skipArrayHoles
    ? presentArraySources(input, input.expression)
    : canonicalValueForOfSources({
        resolveAlias: (identifier) => canonicalValueCallbackAliasExpressions(input, identifier),
        source: input.expression,
      })
  ).map(canonicalValueElementCallbackArguments),
  recognized: true,
});

const identifierCallbackArguments = (
  input: CanonicalValueCallbackRuntime & {
    readonly identifier: ESTree.IdentifierReference;
    readonly skipArrayHoles: boolean;
  },
): CanonicalValueCallbackArguments => {
  const sources = input.identifierSources(input.runtime, input.identifier);
  return sources.length === 0
    ? { arguments: [], recognized: false }
    : combineCanonicalValueCallbackArguments(
        sources.map(({ runtime, source }) =>
          canonicalValueCallbackArguments(
            { ...input, runtime },
            { expression: source, skipArrayHoles: input.skipArrayHoles },
          ),
        ),
      );
};

const staticLength = (expression: ESTree.Expression): number | null => {
  const primitive = expression.type === "Literal" ? expression.value : null;
  return typeof primitive === "number" && Number.isSafeInteger(primitive) && primitive >= 0
    ? primitive
    : null;
};

const repeatedUnknownArguments = (length: number): CanonicalValueCallbackArguments => ({
  arguments: Array.from({ length }, canonicalValueUnknownCallbackArguments),
  recognized: true,
});

const constructorName = (
  input: CanonicalValueCallbackRuntime,
  expression: ESTree.NewExpression,
): string | null => {
  const callee = unwrapExpression(expression.callee);
  if (callee.type !== "Identifier") return null;
  return canonicalValueIsGlobalIdentifier(input.runtime, { expression: callee, name: callee.name })
    ? callee.name
    : null;
};

type ConstructedCallbackInput = CanonicalValueCallbackRuntime & {
  readonly expression: ESTree.NewExpression;
  readonly first: ESTree.Expression | null;
  readonly name: string | null;
  readonly skipArrayHoles: boolean;
};

const arrayConstructorArguments = (
  input: ConstructedCallbackInput,
): CanonicalValueCallbackArguments | null => {
  if (input.name !== "Array") return null;
  const length =
    input.first === null || input.expression.arguments.length !== 1
      ? null
      : staticLength(input.first);
  if (length !== null) {
    return input.skipArrayHoles ? repeatedUnknownArguments(0) : repeatedUnknownArguments(length);
  }
  const synthetic: ESTree.ArrayExpression = {
    elements: input.expression.arguments,
    end: input.expression.end,
    loc: input.expression.loc,
    parent: input.expression.parent,
    range: input.expression.range,
    start: input.expression.start,
    type: "ArrayExpression",
  };
  return arrayCallbackArguments({ ...input, expression: synthetic });
};

const setOrMapConstructorArguments = (
  input: ConstructedCallbackInput,
): CanonicalValueCallbackArguments | null => {
  if (input.name !== "Set" && input.name !== "Map") return null;
  return input.first === null
    ? repeatedUnknownArguments(0)
    : canonicalValueCallbackArguments(input, {
        expression: input.first,
        skipArrayHoles: false,
      });
};

const searchParameterConstructorArguments = (
  input: ConstructedCallbackInput,
): CanonicalValueCallbackArguments | null => {
  if (input.name !== "URLSearchParams") return null;
  const parameter = input.first?.type === "Literal" ? input.first.value : null;
  if (parameter === null || parameter === "") return repeatedUnknownArguments(0);
  return typeof parameter === "string"
    ? repeatedUnknownArguments(new URLSearchParams(parameter).size)
    : { arguments: [canonicalValueUnknownCallbackArguments()], recognized: true };
};

const typedArrayConstructorArguments = (
  input: ConstructedCallbackInput,
): CanonicalValueCallbackArguments => {
  if (input.name?.endsWith("Array") !== true) return { arguments: [], recognized: false };
  const length = input.first === null ? 0 : staticLength(input.first);
  if (length !== null) return repeatedUnknownArguments(length);
  return input.first === null
    ? repeatedUnknownArguments(0)
    : canonicalValueCallbackArguments(input, {
        expression: input.first,
        skipArrayHoles: false,
      });
};

const constructedCallbackArguments = (
  input: CanonicalValueCallbackRuntime & {
    readonly expression: ESTree.NewExpression;
    readonly skipArrayHoles: boolean;
  },
): CanonicalValueCallbackArguments => {
  const constructedInput: ConstructedCallbackInput = {
    ...input,
    first: canonicalValueArgumentExpression(input.expression.arguments[0]),
    name: constructorName(input, input.expression),
  };
  return (
    arrayConstructorArguments(constructedInput) ??
    setOrMapConstructorArguments(constructedInput) ??
    searchParameterConstructorArguments(constructedInput) ??
    typedArrayConstructorArguments(constructedInput)
  );
};

const flowCallbackArguments = (
  input: CanonicalValueCallbackRuntime & {
    readonly expression: ESTree.ConditionalExpression | ESTree.LogicalExpression;
    readonly skipArrayHoles: boolean;
  },
): CanonicalValueCallbackArguments =>
  combineCanonicalValueCallbackArguments(
    input.expression.type === "ConditionalExpression"
      ? [
          canonicalValueCallbackArguments(input, {
            expression: input.expression.consequent,
            skipArrayHoles: input.skipArrayHoles,
          }),
          canonicalValueCallbackArguments(input, {
            expression: input.expression.alternate,
            skipArrayHoles: input.skipArrayHoles,
          }),
        ]
      : [
          canonicalValueCallbackArguments(input, {
            expression: input.expression.left,
            skipArrayHoles: input.skipArrayHoles,
          }),
          canonicalValueCallbackArguments(input, {
            expression: input.expression.right,
            skipArrayHoles: input.skipArrayHoles,
          }),
        ],
  );

const callCallbackArguments = (
  input: CanonicalValueCallbackRuntime & { readonly expression: ESTree.CallExpression },
): CanonicalValueCallbackArguments =>
  canonicalValueObjectEnumerationCallbackArguments(input, input.expression) ?? {
    arguments: [],
    recognized: false,
  };

const sequenceCallbackArguments = (
  input: CanonicalValueCallbackRuntime & {
    readonly expression: ESTree.SequenceExpression;
    readonly skipArrayHoles: boolean;
  },
): CanonicalValueCallbackArguments => {
  const last = input.expression.expressions.at(-1);
  return last === undefined
    ? { arguments: [], recognized: false }
    : canonicalValueCallbackArguments(input, {
        expression: last,
        skipArrayHoles: input.skipArrayHoles,
      });
};

export const canonicalValueCallbackArguments = (
  input: CanonicalValueCallbackRuntime,
  query: { readonly expression: ESTree.Expression; readonly skipArrayHoles?: boolean },
): CanonicalValueCallbackArguments => {
  const callbackInput: CanonicalValueCallbackRuntime & {
    readonly expression: ESTree.Expression;
    readonly skipArrayHoles: boolean;
  } = {
    ...input,
    expression: unwrapExpression(query.expression),
    skipArrayHoles: query.skipArrayHoles ?? false,
  };
  switch (callbackInput.expression.type) {
    case "ArrayExpression":
      return arrayCallbackArguments({ ...callbackInput, expression: callbackInput.expression });
    case "Identifier":
      return identifierCallbackArguments({
        ...callbackInput,
        identifier: callbackInput.expression,
      });
    case "NewExpression":
      return constructedCallbackArguments({
        ...callbackInput,
        expression: callbackInput.expression,
      });
    case "CallExpression":
      return callCallbackArguments({ ...callbackInput, expression: callbackInput.expression });
    case "ConditionalExpression":
    case "LogicalExpression":
      return flowCallbackArguments({ ...callbackInput, expression: callbackInput.expression });
    case "SequenceExpression":
      return sequenceCallbackArguments({ ...callbackInput, expression: callbackInput.expression });
    default:
      return { arguments: [], recognized: false };
  }
};
