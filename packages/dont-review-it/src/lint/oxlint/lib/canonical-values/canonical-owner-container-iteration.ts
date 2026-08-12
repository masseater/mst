import * as ts from "typescript-6";

import {
  canonicalOwnerExpressionArrayElementIsOwner,
  canonicalOwnerExpressionMapValueIsOwner,
} from "./canonical-owner-address.ts";
import { canonicalOwnerCalledFunctions } from "./canonical-owner-call.ts";
import { canonicalOwnerExpressionIsOwner } from "./canonical-owner-expression.ts";
import { canonicalOwnerExpressionIsDefaultLibrary } from "./canonical-owner-standard.ts";
import {
  addCanonicalOwnerSymbol,
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

const iteratedExpressionContainsOwner = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (ts.isCallExpression(current) && canonicalOwnerMemberName(current.expression) === "values") {
    const receiver = canonicalOwnerMemberReceiver(current.expression);
    return (
      receiver !== null && canonicalOwnerExpressionMapValueIsOwner({ expression: receiver, state })
    );
  }
  return canonicalOwnerExpressionArrayElementIsOwner({ expression: current, state });
};

const addIterationBinding = (input: {
  readonly initializer: ts.ForInitializer;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  if (!ts.isVariableDeclarationList(input.initializer)) return false;
  const declaration = input.initializer.declarations[0];
  return declaration !== undefined && ts.isIdentifier(declaration.name)
    ? addCanonicalOwnerSymbol(
        input.state,
        input.state.checker.getSymbolAtLocation(declaration.name),
      )
    : false;
};

const addForOfOrigin = (state: CanonicalOwnerAliasState, node: ts.Node): boolean =>
  ts.isForOfStatement(node) && iteratedExpressionContainsOwner(state, node.expression)
    ? addIterationBinding({ initializer: node.initializer, state })
    : false;

const initializerAtExpression = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): ts.Expression | null => {
  const symbol = canonicalOwnerSymbolAtExpression(state.checker, expression);
  const resolved = symbol === null ? null : resolveTypeScriptSymbol(state.checker, symbol);
  const declaration = resolved?.declarations?.find(
    (candidate) => ts.isVariableDeclaration(candidate) && candidate.initializer !== undefined,
  );
  return declaration !== undefined && ts.isVariableDeclaration(declaration)
    ? (declaration.initializer ?? null)
    : null;
};

const promiseExpressionContainsOwner = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (ts.isCallExpression(current)) {
    const name = canonicalOwnerMemberName(current.expression);
    const promised = current.arguments[0];
    return (
      name === "resolve" &&
      promised !== undefined &&
      canonicalOwnerExpressionIsDefaultLibrary(state, current.expression) &&
      canonicalOwnerExpressionIsOwner({ expression: promised, state })
    );
  }
  const initializer = initializerAtExpression(state, current);
  return initializer !== null && initializer !== current
    ? promiseExpressionContainsOwner(state, initializer)
    : false;
};

const addPromiseCallbackOrigin = (state: CanonicalOwnerAliasState, node: ts.Node): boolean => {
  if (
    !ts.isCallExpression(node) ||
    canonicalOwnerMemberName(node.expression) !== "then" ||
    !canonicalOwnerExpressionIsDefaultLibrary(state, node.expression)
  ) {
    return false;
  }
  const receiver = canonicalOwnerMemberReceiver(node.expression);
  const callback = node.arguments[0];
  if (
    receiver === null ||
    callback === undefined ||
    !promiseExpressionContainsOwner(state, receiver)
  ) {
    return false;
  }
  return canonicalOwnerCalledFunctions(state.checker, callback)
    .map((function_) => {
      const parameter = function_.parameters[0];
      return parameter !== undefined && ts.isIdentifier(parameter.name)
        ? addCanonicalOwnerSymbol(state, state.checker.getSymbolAtLocation(parameter.name))
        : false;
    })
    .some(Boolean);
};

export const addCanonicalOwnerIterationOrigins = (
  state: CanonicalOwnerAliasState,
  node: ts.Node,
): boolean => [addForOfOrigin(state, node), addPromiseCallbackOrigin(state, node)].some(Boolean);
