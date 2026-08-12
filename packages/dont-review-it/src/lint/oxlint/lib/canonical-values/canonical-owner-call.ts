import * as ts from "typescript-6";

import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
  type ExecutableFunction,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

export type CanonicalOwnerFunctionInvocation = {
  readonly arguments: readonly ts.Expression[];
  readonly function_: ExecutableFunction;
};

type CanonicalOwnerCallableOrigin = {
  readonly boundArguments: readonly ts.Expression[];
  readonly function_: ExecutableFunction;
};

type CallableResolution = {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program | null;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
};

const executableFunction = (node: ts.Node): node is ExecutableFunction =>
  ts.isFunctionLike(node) && "body" in node && node.body !== undefined;

const declarationInitializer = (declaration: ts.Declaration): ts.Expression | null => {
  if (
    ts.isVariableDeclaration(declaration) ||
    ts.isPropertyAssignment(declaration) ||
    ts.isPropertyDeclaration(declaration) ||
    ts.isBindingElement(declaration)
  ) {
    return declaration.initializer ?? null;
  }
  return null;
};

const boundCallableOrigins = (
  input: CallableResolution,
  current: ts.Expression,
): readonly CanonicalOwnerCallableOrigin[] | null => {
  if (
    !ts.isCallExpression(current) ||
    input.program === null ||
    canonicalOwnerMemberName(current.expression) !== "bind"
  ) {
    return null;
  }
  const program = input.program;
  const receiver = canonicalOwnerMemberReceiver(current.expression);
  const symbol = canonicalOwnerSymbolAtExpression(input.checker, current.expression);
  const standard =
    symbol !== null &&
    (resolveTypeScriptSymbol(input.checker, symbol).declarations ?? []).some((declaration) =>
      program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
    );
  if (receiver === null || !standard) return null;
  return callableOrigins({ ...input, expression: receiver }).map((origin) => ({
    boundArguments: [...origin.boundArguments, ...current.arguments.slice(1)],
    function_: origin.function_,
  }));
};

const declarationOrigins = (input: {
  readonly declaration: ts.Declaration;
  readonly resolution: CallableResolution;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
}): readonly CanonicalOwnerCallableOrigin[] => {
  if (executableFunction(input.declaration)) {
    return [{ boundArguments: [], function_: input.declaration }];
  }
  const initializer = declarationInitializer(input.declaration);
  return initializer === null
    ? []
    : callableOrigins({
        ...input.resolution,
        expression: initializer,
        seenSymbols: input.seenSymbols,
      });
};

const symbolCallableOrigins = (
  input: CallableResolution,
  current: ts.Expression,
): readonly CanonicalOwnerCallableOrigin[] => {
  const symbol = canonicalOwnerSymbolAtExpression(input.checker, current);
  if (symbol === null) return [];
  const resolved = resolveTypeScriptSymbol(input.checker, symbol);
  if (input.seenSymbols.has(resolved)) return [];
  const next = new Set([...input.seenSymbols, resolved]);
  return [
    ...[...(input.aliases.get(symbol) ?? []), ...(input.aliases.get(resolved) ?? [])].map(
      (function_): CanonicalOwnerCallableOrigin => ({ boundArguments: [], function_ }),
    ),
    ...(resolved.declarations ?? []).flatMap((declaration) =>
      declarationOrigins({ declaration, resolution: input, seenSymbols: next }),
    ),
  ];
};

const callableOrigins = (input: CallableResolution): readonly CanonicalOwnerCallableOrigin[] => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  if (executableFunction(current)) return [{ boundArguments: [], function_: current }];
  return boundCallableOrigins(input, current) ?? symbolCallableOrigins(input, current);
};

export const canonicalOwnerCalledFunctions = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): readonly ExecutableFunction[] =>
  callableOrigins({
    aliases: new Map(),
    checker,
    expression,
    program: null,
    seenSymbols: new Set(),
  }).map((origin) => origin.function_);

export const canonicalOwnerAliasedCalledFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
}): readonly ExecutableFunction[] =>
  callableOrigins({ ...input, program: null, seenSymbols: new Set() }).map(
    (origin) => origin.function_,
  );

export type CanonicalOwnerArrayArgumentResolution = {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression | undefined;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
};

const arrayLiteralArguments = (
  input: CanonicalOwnerArrayArgumentResolution,
  array: ts.ArrayLiteralExpression,
): readonly ts.Expression[] | null =>
  array.elements.reduce<readonly ts.Expression[] | null>((arguments_, element) => {
    if (arguments_ === null || ts.isOmittedExpression(element)) return arguments_;
    if (!ts.isSpreadElement(element)) return [...arguments_, element];
    const spread = arrayArguments({ ...input, expression: element.expression });
    return spread === null ? null : [...arguments_, ...spread];
  }, []);

const declaredArrayArguments = (
  input: CanonicalOwnerArrayArgumentResolution,
  current: ts.Expression,
): readonly ts.Expression[] | null => {
  const symbol = canonicalOwnerSymbolAtExpression(input.checker, current);
  const resolved = symbol === null ? null : resolveTypeScriptSymbol(input.checker, symbol);
  if (resolved === null || input.seenSymbols.has(resolved)) return null;
  const next = new Set([...input.seenSymbols, resolved]);
  return (resolved.declarations ?? []).reduce<readonly ts.Expression[] | null>(
    (arguments_, declaration) => {
      if (arguments_ !== null) return arguments_;
      const initializer = declarationInitializer(declaration);
      return initializer === null
        ? null
        : arrayArguments({ ...input, expression: initializer, seenSymbols: next });
    },
    null,
  );
};

const arrayArguments = (
  input: CanonicalOwnerArrayArgumentResolution,
): readonly ts.Expression[] | null => {
  if (input.expression === undefined) return [];
  const current = unwrapCanonicalOwnerExpression(input.expression);
  return ts.isArrayLiteralExpression(current)
    ? arrayLiteralArguments(input, current)
    : declaredArrayArguments(input, current);
};

const forwardedInvocation = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
}): readonly CanonicalOwnerFunctionInvocation[] | null => {
  const name = canonicalOwnerMemberName(input.call.expression);
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  if ((name !== "call" && name !== "apply") || receiver === null) return null;
  const symbol = canonicalOwnerSymbolAtExpression(input.checker, input.call.expression);
  const standard =
    symbol !== null &&
    (resolveTypeScriptSymbol(input.checker, symbol).declarations ?? []).some((declaration) =>
      input.program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
    );
  if (!standard) return null;
  const arguments_ =
    name === "call"
      ? input.call.arguments.slice(1)
      : arrayArguments({
          checker: input.checker,
          expression: input.call.arguments[1],
          seenSymbols: new Set(),
        });
  if (arguments_ === null) return [];
  return callableOrigins({
    aliases: input.aliases,
    checker: input.checker,
    expression: receiver,
    program: input.program,
    seenSymbols: new Set(),
  }).map((origin) => ({
    arguments: [...origin.boundArguments, ...arguments_],
    function_: origin.function_,
  }));
};

export const canonicalOwnerFunctionInvocations = (input: {
  readonly aliases?: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
}): readonly CanonicalOwnerFunctionInvocation[] => {
  const aliases = input.aliases ?? new Map();
  const forwarded = forwardedInvocation({ ...input, aliases });
  if (forwarded !== null) return forwarded;
  return callableOrigins({
    aliases,
    checker: input.checker,
    expression: input.call.expression,
    program: input.program,
    seenSymbols: new Set(),
  }).map((origin) => ({
    arguments: [...origin.boundArguments, ...input.call.arguments],
    function_: origin.function_,
  }));
};

const decoratorsOf = (node: ts.Node): readonly ts.Decorator[] =>
  ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];

const declarationNameOf = (node: ts.Node): ts.DeclarationName | null => {
  if (
    ts.isPropertyDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node)
  ) {
    return node.name ?? null;
  }
  return null;
};

const definitionTimeNodes = (node: ts.Node): readonly ts.Node[] => {
  const decorated = decoratorsOf(node).flatMap(canonicalOwnerNodesInContext);
  const name = declarationNameOf(node);
  const named =
    name !== null && ts.isComputedPropertyName(name) ? canonicalOwnerNodesInContext(name) : [];
  return [node, ...decorated, ...named];
};

const propertyDeclarationNodes = (node: ts.PropertyDeclaration): readonly ts.Node[] => {
  const definition = definitionTimeNodes(node);
  const isStatic = (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static) !== 0;
  return isStatic && node.initializer !== undefined
    ? [...definition, ...canonicalOwnerNodesInContext(node.initializer)]
    : definition;
};

const contextChildren = (node: ts.Node): readonly ts.Node[] => {
  if (ts.isPropertyDeclaration(node)) return propertyDeclarationNodes(node).slice(1);
  if (ts.isFunctionLike(node)) return definitionTimeNodes(node).slice(1);
  return node.getChildren().flatMap(canonicalOwnerNodesInContext);
};

export const canonicalOwnerNodesInContext = (root: ts.Node): readonly ts.Node[] => [
  root,
  ...contextChildren(root),
];

export const canonicalOwnerReturnExpressions = (
  function_: ExecutableFunction,
): readonly ts.Expression[] =>
  ts.isBlock(function_.body)
    ? canonicalOwnerNodesInContext(function_.body).flatMap((node) =>
        ts.isReturnStatement(node) && node.expression !== undefined ? [node.expression] : [],
      )
    : [function_.body];
