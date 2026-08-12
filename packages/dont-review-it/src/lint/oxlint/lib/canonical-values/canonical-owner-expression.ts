import * as ts from "typescript-6";

import {
  canonicalOwnerExpressionAddressIsOwner,
  canonicalOwnerExpressionArrayElementIsOwner,
  canonicalOwnerExpressionKey,
  canonicalOwnerExpressionMapValueIsOwner,
  canonicalOwnerReferenceKey,
} from "./canonical-owner-address.ts";
import {
  canonicalOwnerCalledFunctions,
  canonicalOwnerFunctionInvocations,
  canonicalOwnerNodesInContext,
  canonicalOwnerReturnExpressions,
} from "./canonical-owner-call.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  canonicalOwnerSymbolIs,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
  type ExecutableFunction,
} from "./canonical-owner-state.ts";

const objectLiteralFor = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): ts.ObjectLiteralExpression | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (ts.isObjectLiteralExpression(current)) return current;
  if (!ts.isIdentifier(current)) return null;
  const symbol = checker.getSymbolAtLocation(current);
  const declaration = symbol?.declarations?.find(
    (candidate) => ts.isVariableDeclaration(candidate) && candidate.initializer !== undefined,
  );
  if (declaration === undefined || !ts.isVariableDeclaration(declaration)) return null;
  const initializer = declaration.initializer;
  if (initializer === undefined) return null;
  const object = unwrapCanonicalOwnerExpression(initializer);
  return ts.isObjectLiteralExpression(object) ? object : null;
};

export const canonicalOwnerPropertyInitializer = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): ts.Expression | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  const receiver = canonicalOwnerMemberReceiver(current);
  const name = canonicalOwnerMemberName(current);
  if (receiver === null || name === null) return null;
  const object = objectLiteralFor(checker, receiver);
  if (object === null) return null;
  const property = object.properties.find(
    (candidate) =>
      (ts.isPropertyAssignment(candidate) || ts.isShorthandPropertyAssignment(candidate)) &&
      candidate.name.getText().replaceAll(/["']/gu, "") === name,
  );
  if (property === undefined) return null;
  if (ts.isPropertyAssignment(property)) return property.initializer;
  return ts.isShorthandPropertyAssignment(property) ? property.name : null;
};

const returnedOwner = (input: {
  readonly expression: ts.CallExpression;
  readonly seenFunctions: ReadonlySet<ExecutableFunction>;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  canonicalOwnerFunctionInvocations({
    call: input.expression,
    checker: input.state.checker,
    program: input.state.program,
  }).some(({ function_ }) => {
    if (input.seenFunctions.has(function_)) return false;
    const seenFunctions = new Set([...input.seenFunctions, function_]);
    return canonicalOwnerReturnExpressions(function_).some((returned) =>
      canonicalOwnerExpressionIsOwner({
        expression: returned,
        seenFunctions,
        state: input.state,
      }),
    );
  });

const projectedCallIsOwner = (
  state: CanonicalOwnerAliasState,
  expression: ts.CallExpression,
): boolean => {
  const receiver = canonicalOwnerMemberReceiver(expression.expression);
  const name = canonicalOwnerMemberName(expression.expression);
  const argument = expression.arguments[0];
  if (receiver === null || argument === undefined || (name !== "at" && name !== "get")) {
    return false;
  }
  const key =
    name === "get"
      ? canonicalOwnerReferenceKey(state, argument)
      : canonicalOwnerExpressionKey(state, argument);
  const exact =
    key !== null &&
    canonicalOwnerExpressionAddressIsOwner({
      expression: receiver,
      state,
      suffix: [name === "get" ? `$map:${key}` : key],
    });
  return (
    exact ||
    (name === "at"
      ? canonicalOwnerExpressionArrayElementIsOwner({ expression: receiver, state })
      : canonicalOwnerExpressionMapValueIsOwner({ expression: receiver, state }))
  );
};

const generatorYieldIsOwner = (input: {
  readonly function_: ExecutableFunction;
  readonly seenFunctions: ReadonlySet<ExecutableFunction>;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  canonicalOwnerNodesInContext(input.function_.body).some(
    (node) =>
      ts.isYieldExpression(node) &&
      node.expression !== undefined &&
      canonicalOwnerExpressionIsOwner({
        expression: node.expression,
        seenFunctions: new Set([...input.seenFunctions, input.function_]),
        state: input.state,
      }),
  );

const generatorResultIsOwner = (input: {
  readonly expression: ts.Expression;
  readonly seenFunctions: ReadonlySet<ExecutableFunction>;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  if (canonicalOwnerMemberName(input.expression) !== "value") return false;
  const nextCallExpression = canonicalOwnerMemberReceiver(input.expression);
  const nextCall =
    nextCallExpression === null ? null : unwrapCanonicalOwnerExpression(nextCallExpression);
  if (
    nextCall === null ||
    !ts.isCallExpression(nextCall) ||
    canonicalOwnerMemberName(nextCall.expression) !== "next"
  ) {
    return false;
  }
  const generatorCallExpression = canonicalOwnerMemberReceiver(nextCall.expression);
  const generatorCall =
    generatorCallExpression === null
      ? null
      : unwrapCanonicalOwnerExpression(generatorCallExpression);
  return generatorCall !== null && ts.isCallExpression(generatorCall)
    ? canonicalOwnerCalledFunctions(input.state.checker, generatorCall.expression).some(
        (function_) =>
          function_.asteriskToken !== undefined &&
          !input.seenFunctions.has(function_) &&
          generatorYieldIsOwner({ ...input, function_ }),
      )
    : false;
};

type LogicalState = {
  readonly nullish: boolean | null;
  readonly truthy: boolean | null;
};

const keywordLogicalState = (expression: ts.Expression): LogicalState | null => {
  if (expression.kind === ts.SyntaxKind.NullKeyword) return { nullish: true, truthy: false };
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return { nullish: false, truthy: true };
  return expression.kind === ts.SyntaxKind.FalseKeyword ? { nullish: false, truthy: false } : null;
};

const literalLogicalState = (expression: ts.Expression): LogicalState | null => {
  if (ts.isStringLiteralLike(expression)) {
    return { nullish: false, truthy: expression.text.length > 0 };
  }
  return ts.isNumericLiteral(expression)
    ? { nullish: false, truthy: Number(expression.text) !== 0 }
    : null;
};

const expressionIsStaticallyTruthy = (expression: ts.Expression): boolean =>
  ts.isArrayLiteralExpression(expression) ||
  ts.isObjectLiteralExpression(expression) ||
  ts.isFunctionExpression(expression) ||
  ts.isArrowFunction(expression) ||
  ts.isClassExpression(expression) ||
  ts.isNewExpression(expression);

const staticLogicalState = (owner: boolean, expression: ts.Expression): LogicalState => {
  if (owner) return { nullish: false, truthy: true };
  const current = unwrapCanonicalOwnerExpression(expression);
  const known = keywordLogicalState(current) ?? literalLogicalState(current);
  if (known !== null) return known;
  return expressionIsStaticallyTruthy(current)
    ? { nullish: false, truthy: true }
    : { nullish: null, truthy: null };
};

const LOGICAL_OPERATORS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

const logicalReachability = (
  operator: ts.SyntaxKind,
  state: LogicalState,
): { readonly left: boolean; readonly right: boolean } => {
  if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
    return { left: state.truthy !== true, right: state.truthy !== false };
  }
  if (operator === ts.SyntaxKind.BarBarToken) {
    return { left: state.truthy !== false, right: state.truthy !== true };
  }
  return { left: state.nullish !== true, right: state.nullish !== false };
};

const logicalExpressionIsOwner = (input: {
  readonly expression: ts.BinaryExpression;
  readonly seenFunctions: ReadonlySet<ExecutableFunction>;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const operator = input.expression.operatorToken.kind;
  if (operator === ts.SyntaxKind.CommaToken) {
    return canonicalOwnerExpressionIsOwner({ ...input, expression: input.expression.right });
  }
  if (!LOGICAL_OPERATORS.has(operator)) return false;
  const leftIsOwner = canonicalOwnerExpressionIsOwner({
    ...input,
    expression: input.expression.left,
  });
  const state = staticLogicalState(leftIsOwner, input.expression.left);
  const reachable = logicalReachability(operator, state);
  if (reachable.left && leftIsOwner) return true;
  return (
    reachable.right &&
    canonicalOwnerExpressionIsOwner({ ...input, expression: input.expression.right })
  );
};

const structuralExpressionIsOwner = (input: {
  readonly expression: ts.Expression;
  readonly seenFunctions: ReadonlySet<ExecutableFunction>;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const { expression } = input;
  if (ts.isAwaitExpression(expression)) {
    return canonicalOwnerExpressionIsOwner({ ...input, expression: expression.expression });
  }
  if (ts.isConditionalExpression(expression)) {
    return [expression.whenTrue, expression.whenFalse].some((branch) =>
      canonicalOwnerExpressionIsOwner({ ...input, expression: branch }),
    );
  }
  if (ts.isBinaryExpression(expression)) return logicalExpressionIsOwner({ ...input, expression });
  if (ts.isCommaListExpression(expression)) {
    const last = expression.elements.at(-1);
    return last !== undefined && canonicalOwnerExpressionIsOwner({ ...input, expression: last });
  }
  return ts.isCallExpression(expression) && returnedOwner({ ...input, expression });
};

const directExpressionIsOwner = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean =>
  canonicalOwnerSymbolIs(state, canonicalOwnerSymbolAtExpression(state.checker, expression)) ||
  canonicalOwnerExpressionAddressIsOwner({ expression, state }) ||
  (ts.isElementAccessExpression(expression) &&
    canonicalOwnerExpressionArrayElementIsOwner({
      expression: expression.expression,
      state,
    }));

const indirectExpressionIsOwner = (input: {
  readonly expression: ts.Expression;
  readonly seenFunctions: ReadonlySet<ExecutableFunction>;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const initializer = canonicalOwnerPropertyInitializer(input.state.checker, input.expression);
  if (initializer !== null && initializer !== input.expression) {
    return canonicalOwnerExpressionIsOwner({ ...input, expression: initializer });
  }
  if (
    ts.isBinaryExpression(input.expression) &&
    input.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ) {
    return canonicalOwnerExpressionIsOwner({ ...input, expression: input.expression.right });
  }
  if (
    ts.isCallExpression(input.expression) &&
    projectedCallIsOwner(input.state, input.expression)
  ) {
    return true;
  }
  return structuralExpressionIsOwner(input);
};

export const canonicalOwnerExpressionIsOwner = (input: {
  readonly expression: ts.Expression;
  readonly seenFunctions?: ReadonlySet<ExecutableFunction>;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const expression = unwrapCanonicalOwnerExpression(input.expression);
  if (directExpressionIsOwner(input.state, expression)) return true;
  const seenFunctions = input.seenFunctions ?? new Set<ExecutableFunction>();
  if (generatorResultIsOwner({ expression, seenFunctions, state: input.state })) return true;
  return indirectExpressionIsOwner({ expression, seenFunctions, state: input.state });
};
