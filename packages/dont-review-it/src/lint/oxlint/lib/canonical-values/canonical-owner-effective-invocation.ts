import * as ts from "typescript-6";

import { type CanonicalOwnerArrayArgumentResolution } from "./canonical-owner-call.ts";
import { canonicalOwnerExpressionIsFromDefaultLibrary } from "./canonical-owner-default-library.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

export type CanonicalOwnerEffectiveInvocation = {
  readonly arguments: readonly ts.Expression[];
  readonly target: ts.Expression;
};

type CallableOrigin = {
  readonly boundArguments: readonly ts.Expression[];
  readonly boundThis: ts.Expression | null;
  readonly target: ts.Expression;
};

type CallableResolution = {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
};

const variableInitializer = (declaration: ts.Declaration): ts.Expression | null => {
  if (!ts.isVariableDeclaration(declaration) || declaration.initializer === undefined) return null;
  return (declaration.parent.flags & ts.NodeFlags.Const) !== 0 ? declaration.initializer : null;
};

const bindingPropertySource = (declaration: ts.Declaration): ts.Expression | null => {
  if (!ts.isBindingElement(declaration) || declaration.propertyName === undefined) return null;
  const name = declaration.propertyName;
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
    ? name
    : null;
};

const declarationSource = (declaration: ts.Declaration): ts.Expression | null =>
  variableInitializer(declaration) ?? bindingPropertySource(declaration);

const flowOrigins = (
  resolution: CallableResolution,
  current: ts.Expression,
): readonly CallableOrigin[] | null => {
  if (ts.isConditionalExpression(current)) {
    return [
      ...callableOrigins({ ...resolution, expression: current.whenTrue }),
      ...callableOrigins({ ...resolution, expression: current.whenFalse }),
    ];
  }
  if (ts.isCommaListExpression(current)) {
    const last = current.elements.at(-1);
    return last === undefined ? [] : callableOrigins({ ...resolution, expression: last });
  }
  if (
    ts.isBinaryExpression(current) &&
    (current.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
      current.operatorToken.kind === ts.SyntaxKind.CommaToken)
  ) {
    return callableOrigins({ ...resolution, expression: current.right });
  }
  return null;
};

const bindOrigins = (
  resolution: CallableResolution,
  current: ts.Expression,
): readonly CallableOrigin[] | null => {
  if (
    !ts.isCallExpression(current) ||
    canonicalOwnerMemberName(current.expression) !== "bind" ||
    !canonicalOwnerExpressionIsFromDefaultLibrary({
      ...resolution,
      expression: current.expression,
    })
  ) {
    return null;
  }
  const receiver = canonicalOwnerMemberReceiver(current.expression);
  if (receiver === null || current.arguments.some(ts.isSpreadElement)) return [];
  const boundThis = current.arguments[0] ?? null;
  return callableOrigins({ ...resolution, expression: receiver }).map((origin) => ({
    boundArguments: [...origin.boundArguments, ...current.arguments.slice(1)],
    boundThis: origin.boundThis ?? boundThis,
    target: origin.target,
  }));
};

const symbolOrigins = (
  resolution: CallableResolution,
  current: ts.Expression,
): readonly CallableOrigin[] | null => {
  const symbol = canonicalOwnerSymbolAtExpression(resolution.checker, current);
  if (symbol === null) return null;
  const resolved = resolveTypeScriptSymbol(resolution.checker, symbol);
  if (resolution.seenSymbols.has(resolved)) return [];
  const next = new Set([...resolution.seenSymbols, resolved]);
  const sources = (resolved.declarations ?? []).flatMap((declaration) => {
    const source = declarationSource(declaration);
    return source === null ? [] : [source];
  });
  return sources.length === 0
    ? null
    : sources.flatMap((source) =>
        callableOrigins({ ...resolution, expression: source, seenSymbols: next }),
      );
};

const callableOrigins = (resolution: CallableResolution): readonly CallableOrigin[] => {
  const current = unwrapCanonicalOwnerExpression(resolution.expression);
  const flow = flowOrigins(resolution, current);
  if (flow !== null) return flow;
  const bound = bindOrigins(resolution, current);
  if (bound !== null) return bound;
  const symbols = symbolOrigins(resolution, current);
  return symbols ?? [{ boundArguments: [], boundThis: null, target: current }];
};

const arrayLiteralArguments = (
  resolution: CanonicalOwnerArrayArgumentResolution,
  expression: ts.ArrayLiteralExpression,
): readonly ts.Expression[] | null =>
  expression.elements.reduce<readonly ts.Expression[] | null>((arguments_, element) => {
    if (arguments_ === null || ts.isOmittedExpression(element)) return arguments_;
    if (!ts.isSpreadElement(element)) return [...arguments_, element];
    const spread = arrayArguments({ ...resolution, expression: element.expression });
    return spread === null ? null : [...arguments_, ...spread];
  }, []);

const arrayArguments = (
  resolution: CanonicalOwnerArrayArgumentResolution,
): readonly ts.Expression[] | null => {
  if (resolution.expression === undefined) return [];
  const current = unwrapCanonicalOwnerExpression(resolution.expression);
  if (ts.isArrayLiteralExpression(current)) return arrayLiteralArguments(resolution, current);
  const symbol = canonicalOwnerSymbolAtExpression(resolution.checker, current);
  if (symbol === null) return null;
  const resolved = resolveTypeScriptSymbol(resolution.checker, symbol);
  if (resolution.seenSymbols.has(resolved)) return null;
  const source = (resolved.declarations ?? [])
    .map(declarationSource)
    .find((value) => value !== null);
  return source === undefined
    ? null
    : arrayArguments({
        ...resolution,
        expression: source,
        seenSymbols: new Set([...resolution.seenSymbols, resolved]),
      });
};

const reflectApply = (input: {
  readonly checker: ts.TypeChecker;
  readonly origin: CallableOrigin;
  readonly program: ts.Program;
}): boolean => {
  const receiver = canonicalOwnerMemberReceiver(input.origin.target);
  const current = receiver === null ? null : unwrapCanonicalOwnerExpression(receiver);
  return (
    input.origin.boundThis === null &&
    current !== null &&
    ts.isIdentifier(current) &&
    current.text === "Reflect" &&
    canonicalOwnerMemberName(input.origin.target) === "apply" &&
    canonicalOwnerExpressionIsFromDefaultLibrary({
      checker: input.checker,
      expression: input.origin.target,
      program: input.program,
    })
  );
};

type EffectiveCallInput = {
  readonly arguments: readonly ts.Expression[];
  readonly checker: ts.TypeChecker;
  readonly origin: CallableOrigin;
  readonly program: ts.Program;
  readonly seenTargets: ReadonlySet<ts.Expression>;
};

type ForwardedInvocation = {
  readonly arguments: readonly ts.Expression[];
  readonly origins: readonly CallableOrigin[];
};

const reflectForwarding = (
  input: EffectiveCallInput,
  arguments_: readonly ts.Expression[],
): ForwardedInvocation | null => {
  if (!reflectApply(input)) return null;
  const target = arguments_[0];
  const applied = arrayArguments({
    checker: input.checker,
    expression: arguments_[2],
    seenSymbols: new Set(),
  });
  return target === undefined || applied === null
    ? { arguments: [], origins: [] }
    : {
        arguments: applied,
        origins: callableOrigins({
          checker: input.checker,
          expression: target,
          program: input.program,
          seenSymbols: new Set(),
        }),
      };
};

const functionForwarding = (
  input: EffectiveCallInput,
  arguments_: readonly ts.Expression[],
): ForwardedInvocation | null => {
  const name = canonicalOwnerMemberName(input.origin.target);
  const receiver = canonicalOwnerMemberReceiver(input.origin.target);
  if (
    receiver === null ||
    (name !== "call" && name !== "apply") ||
    !canonicalOwnerExpressionIsFromDefaultLibrary({
      checker: input.checker,
      expression: input.origin.target,
      program: input.program,
    })
  ) {
    return null;
  }
  const target = input.origin.boundThis ?? receiver;
  const forwardedArguments =
    name === "call"
      ? arguments_.slice(1)
      : arrayArguments({
          checker: input.checker,
          expression: arguments_[1],
          seenSymbols: new Set(),
        });
  return forwardedArguments === null
    ? { arguments: [], origins: [] }
    : {
        arguments: forwardedArguments,
        origins: callableOrigins({
          checker: input.checker,
          expression: target,
          program: input.program,
          seenSymbols: new Set(),
        }),
      };
};

const effectiveCalls = (
  input: EffectiveCallInput,
): readonly CanonicalOwnerEffectiveInvocation[] => {
  if (input.seenTargets.has(input.origin.target)) return [];
  const seenTargets = new Set([...input.seenTargets, input.origin.target]);
  const arguments_ = [...input.origin.boundArguments, ...input.arguments];
  const forwarding = reflectForwarding(input, arguments_) ?? functionForwarding(input, arguments_);
  if (forwarding === null) return [{ arguments: arguments_, target: input.origin.target }];
  return forwarding.origins.flatMap((origin) =>
    effectiveCalls({ ...input, arguments: forwarding.arguments, origin, seenTargets }),
  );
};

export const canonicalOwnerEffectiveInvocations = (input: {
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
}): readonly CanonicalOwnerEffectiveInvocation[] =>
  callableOrigins({
    checker: input.checker,
    expression: input.call.expression,
    program: input.program,
    seenSymbols: new Set(),
  }).flatMap((origin) =>
    effectiveCalls({
      arguments: input.call.arguments,
      checker: input.checker,
      origin,
      program: input.program,
      seenTargets: new Set(),
    }),
  );
