import * as ts from "typescript-6";

import { canonicalOwnerAliasedCalledFunctions } from "./canonical-owner-call.ts";
import { canonicalOwnerCallbackHasZeroCardinality } from "./canonical-owner-callback-cardinality.ts";
import { canonicalOwnerExpressionIsFromDefaultLibrary } from "./canonical-owner-default-library.ts";
import {
  canonicalOwnerEffectiveInvocations,
  type CanonicalOwnerEffectiveInvocation,
} from "./canonical-owner-effective-invocation.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
  type ExecutableFunction,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

const ARRAY_CALLBACK_METHODS: ReadonlySet<string> = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flatMap",
  "forEach",
  "map",
  "reduce",
  "reduceRight",
  "some",
  "sort",
]);
const GROUP_BY_OWNERS: ReadonlySet<string> = new Set(["MapConstructor", "ObjectConstructor"]);
const JSON_OWNERS: ReadonlySet<string> = new Set(["JSON"]);
const STRING_OWNERS: ReadonlySet<string> = new Set(["String"]);

const promiseSettlement = (input: {
  readonly checker: ts.TypeChecker;
  readonly invocation: CanonicalOwnerEffectiveInvocation;
  readonly program: ts.Program;
}): "fulfilled" | "rejected" | null => {
  const receiver = canonicalOwnerMemberReceiver(input.invocation.target);
  const current = receiver === null ? null : unwrapCanonicalOwnerExpression(receiver);
  if (current === null || !ts.isCallExpression(current)) return null;
  if (!canonicalOwnerExpressionIsFromDefaultLibrary({ ...input, expression: current.expression })) {
    return null;
  }
  const name = canonicalOwnerMemberName(current.expression);
  return name === "resolve" ? "fulfilled" : name === "reject" ? "rejected" : null;
};

type EffectiveCallbackInput = {
  readonly checker: ts.TypeChecker;
  readonly invocation: CanonicalOwnerEffectiveInvocation;
  readonly program: ts.Program;
};

const schedulerCallbackIndexes = (input: EffectiveCallbackInput): readonly number[] => {
  const current = unwrapCanonicalOwnerExpression(input.invocation.target);
  const name = ts.isIdentifier(current) ? current.text : canonicalOwnerMemberName(current);
  return (name === "queueMicrotask" || name === "setInterval" || name === "setTimeout") &&
    canonicalOwnerExpressionIsFromDefaultLibrary({ ...input, expression: current })
    ? [0]
    : [];
};

const promiseCallbackIndexes = (
  input: EffectiveCallbackInput,
  name: string | null,
): readonly number[] => {
  const settlement = promiseSettlement(input);
  if (name === "then") {
    return settlement === "fulfilled" ? [0] : settlement === "rejected" ? [1] : [0, 1];
  }
  return name === "catch" && settlement !== "fulfilled" ? [0] : [];
};

const declarationOwnerName = (declaration: ts.Declaration): string | null => {
  const parent = declaration.parent;
  return (ts.isInterfaceDeclaration(parent) ||
    ts.isClassDeclaration(parent) ||
    ts.isClassExpression(parent)) &&
    parent.name !== undefined
    ? parent.name.text
    : null;
};

const targetDeclaredBy = (input: EffectiveCallbackInput, names: ReadonlySet<string>): boolean => {
  const symbol = canonicalOwnerSymbolAtExpression(input.checker, input.invocation.target);
  return (
    symbol !== null &&
    (resolveTypeScriptSymbol(input.checker, symbol).declarations ?? []).some((declaration) => {
      const owner = declarationOwnerName(declaration);
      return owner !== null && names.has(owner);
    })
  );
};

const definitelyEmptyFirstArgument = (input: EffectiveCallbackInput): boolean => {
  const argument = input.invocation.arguments[0];
  const current = argument === undefined ? null : unwrapCanonicalOwnerExpression(argument);
  return current !== null && ts.isArrayLiteralExpression(current) && current.elements.length === 0;
};

const stringReplacementCannotMatch = (input: EffectiveCallbackInput): boolean => {
  const receiver = canonicalOwnerMemberReceiver(input.invocation.target);
  const search = input.invocation.arguments[0];
  const currentReceiver = receiver === null ? null : unwrapCanonicalOwnerExpression(receiver);
  const currentSearch = search === undefined ? null : unwrapCanonicalOwnerExpression(search);
  return (
    currentReceiver !== null &&
    currentSearch !== null &&
    ts.isStringLiteralLike(currentReceiver) &&
    ts.isStringLiteralLike(currentSearch) &&
    !currentReceiver.text.includes(currentSearch.text)
  );
};

const groupByCallbackIndexes = (
  input: EffectiveCallbackInput,
  name: string | null,
): readonly number[] | null =>
  name === "groupBy" && targetDeclaredBy(input, GROUP_BY_OWNERS)
    ? definitelyEmptyFirstArgument(input)
      ? []
      : [1]
    : null;

const stringCallbackIndexes = (
  input: EffectiveCallbackInput,
  name: string | null,
): readonly number[] | null =>
  (name === "replace" || name === "replaceAll") && targetDeclaredBy(input, STRING_OWNERS)
    ? stringReplacementCannotMatch(input)
      ? []
      : [1]
    : null;

const jsonCallbackIndexes = (
  input: EffectiveCallbackInput,
  name: string | null,
): readonly number[] | null =>
  (name === "parse" || name === "stringify") && targetDeclaredBy(input, JSON_OWNERS) ? [1] : null;

const standardCallbackIndexes = (
  input: EffectiveCallbackInput,
  name: string | null,
): readonly number[] =>
  groupByCallbackIndexes(input, name) ??
  stringCallbackIndexes(input, name) ??
  jsonCallbackIndexes(input, name) ??
  [];

const libraryCallbackIndexes = (input: EffectiveCallbackInput): readonly number[] => {
  if (
    !canonicalOwnerExpressionIsFromDefaultLibrary({
      ...input,
      expression: input.invocation.target,
    })
  ) {
    return [];
  }
  const name = canonicalOwnerMemberName(input.invocation.target);
  if (name !== null && ARRAY_CALLBACK_METHODS.has(name)) {
    return canonicalOwnerCallbackHasZeroCardinality({ ...input, method: name }) ? [] : [0];
  }
  if (name === "from") {
    return canonicalOwnerCallbackHasZeroCardinality({ ...input, method: name }) ? [] : [1];
  }
  if (name === "finally") return [0];
  return [...promiseCallbackIndexes(input, name), ...standardCallbackIndexes(input, name)];
};

const callbackIndexes = (input: EffectiveCallbackInput): readonly number[] => [
  ...schedulerCallbackIndexes(input),
  ...libraryCallbackIndexes(input),
];

const callbackExpressions = (input: {
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
}): readonly ts.Expression[] =>
  canonicalOwnerEffectiveInvocations(input).flatMap((invocation) =>
    callbackIndexes({ ...input, invocation }).flatMap((index) => {
      const argument = invocation.arguments[index];
      return argument === undefined || ts.isSpreadElement(argument) ? [] : [argument];
    }),
  );

export const canonicalOwnerCallbackFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
}): readonly ExecutableFunction[] =>
  callbackExpressions(input).flatMap((callback) =>
    canonicalOwnerAliasedCalledFunctions({
      aliases: input.aliases,
      checker: input.checker,
      expression: callback,
    }).filter((function_) => function_.asteriskToken === undefined),
  );

const addCallableAlias = (input: {
  readonly aliases: Map<ts.Symbol, Set<ExecutableFunction>>;
  readonly function_: ExecutableFunction;
  readonly symbol: ts.Symbol | undefined;
}): boolean => {
  if (input.symbol === undefined) return false;
  const functions = input.aliases.get(input.symbol) ?? new Set<ExecutableFunction>();
  if (functions.has(input.function_)) return false;
  functions.add(input.function_);
  input.aliases.set(input.symbol, functions);
  return true;
};

const addParameterCallableAliases = (input: {
  readonly aliases: Map<ts.Symbol, Set<ExecutableFunction>>;
  readonly argument: ts.Expression | undefined;
  readonly checker: ts.TypeChecker;
  readonly parameter: ts.ParameterDeclaration;
}): readonly boolean[] => {
  if (input.argument === undefined || ts.isSpreadElement(input.argument)) return [];
  const argumentFunctions = canonicalOwnerAliasedCalledFunctions({
    aliases: input.aliases,
    checker: input.checker,
    expression: input.argument,
  });
  const symbol = ts.isIdentifier(input.parameter.name)
    ? input.checker.getSymbolAtLocation(input.parameter.name)
    : undefined;
  const resolved =
    symbol === undefined ? undefined : resolveTypeScriptSymbol(input.checker, symbol);
  return argumentFunctions.flatMap((argumentFunction) => [
    addCallableAlias({ ...input, function_: argumentFunction, symbol }),
    addCallableAlias({ ...input, function_: argumentFunction, symbol: resolved }),
  ]);
};

export const addCanonicalOwnerCallableAliases = (input: {
  readonly aliases: Map<ts.Symbol, Set<ExecutableFunction>>;
  readonly arguments: readonly ts.Expression[];
  readonly checker: ts.TypeChecker;
  readonly functions: readonly ExecutableFunction[];
}): boolean =>
  input.functions
    .flatMap((function_) =>
      function_.parameters.flatMap((parameter, index) =>
        addParameterCallableAliases({
          ...input,
          argument: input.arguments[index],
          parameter,
        }),
      ),
    )
    .some(Boolean);

export const canonicalOwnerPromiseExecutorFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly expression: ts.NewExpression;
  readonly program: ts.Program;
}): readonly ExecutableFunction[] => {
  const constructor = unwrapCanonicalOwnerExpression(input.expression.expression);
  const executor = input.expression.arguments?.[0];
  if (
    executor === undefined ||
    ts.isSpreadElement(executor) ||
    !ts.isIdentifier(constructor) ||
    constructor.text !== "Promise" ||
    !canonicalOwnerExpressionIsFromDefaultLibrary({ ...input, expression: constructor })
  ) {
    return [];
  }
  return canonicalOwnerAliasedCalledFunctions({
    aliases: input.aliases,
    checker: input.checker,
    expression: executor,
  }).filter((function_) => function_.asteriskToken === undefined);
};
