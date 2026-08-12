import * as ts from "typescript-6";

import {
  addCanonicalOwnerExpressionAddress,
  CANONICAL_OWNER_ARRAY_ELEMENT,
  CANONICAL_OWNER_MAP_VALUE,
  canonicalOwnerExpressionArrayElementIsOwner,
  canonicalOwnerExpressionPropertyValueIsOwner,
} from "./canonical-owner-address.ts";
import {
  canonicalOwnerCalledFunctions,
  canonicalOwnerReturnExpressions,
} from "./canonical-owner-call.ts";
import { canonicalOwnerExpressionIsOwner } from "./canonical-owner-expression.ts";
import {
  canonicalOwnerExpressionIsDefaultLibrary,
  canonicalOwnerGlobalIdentifierIs,
} from "./canonical-owner-standard.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
  type ExecutableFunction,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

const arrayLiteralContainsOwner = (
  state: CanonicalOwnerAliasState,
  array: ts.ArrayLiteralExpression,
): boolean =>
  array.elements.some((element) => {
    if (ts.isOmittedExpression(element)) return false;
    return ts.isSpreadElement(element)
      ? expressionContainsOwnerElement(state, element.expression)
      : canonicalOwnerExpressionIsOwner({ expression: element, state });
  });

const expressionContainsOwnerElement = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => {
  const current = unwrapCanonicalOwnerExpression(expression);
  return ts.isArrayLiteralExpression(current)
    ? arrayLiteralContainsOwner(state, current)
    : canonicalOwnerExpressionArrayElementIsOwner({ expression: current, state });
};

const objectLiteralContainsOwner = (
  state: CanonicalOwnerAliasState,
  object: ts.ObjectLiteralExpression,
): boolean =>
  object.properties.some((property) => {
    if (ts.isSpreadAssignment(property)) {
      return expressionContainsOwnerProperty(state, property.expression);
    }
    if (ts.isPropertyAssignment(property)) {
      return canonicalOwnerExpressionIsOwner({ expression: property.initializer, state });
    }
    return (
      ts.isShorthandPropertyAssignment(property) &&
      canonicalOwnerExpressionIsOwner({ expression: property.name, state })
    );
  });

const expressionContainsOwnerProperty = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => {
  const current = unwrapCanonicalOwnerExpression(expression);
  return ts.isObjectLiteralExpression(current)
    ? objectLiteralContainsOwner(state, current)
    : canonicalOwnerExpressionPropertyValueIsOwner({ expression: current, state });
};

const sameSymbol = (input: {
  readonly left: ts.Expression;
  readonly right: ts.BindingName;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  if (!ts.isIdentifier(input.right)) return false;
  const leftSymbol = canonicalOwnerSymbolAtExpression(input.state.checker, input.left);
  const rightSymbol = input.state.checker.getSymbolAtLocation(input.right);
  return (
    leftSymbol !== null &&
    rightSymbol !== undefined &&
    resolveTypeScriptSymbol(input.state.checker, leftSymbol) ===
      resolveTypeScriptSymbol(input.state.checker, rightSymbol)
  );
};

const functionReturnsParameter = (input: {
  readonly function_: ExecutableFunction;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const parameter = input.function_.parameters[0];
  return (
    parameter !== undefined &&
    canonicalOwnerReturnExpressions(input.function_).some((returned) =>
      sameSymbol({ left: returned, right: parameter.name, state: input.state }),
    )
  );
};

const identityCallback = (input: {
  readonly callback: ts.Expression | undefined;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  input.callback !== undefined &&
  canonicalOwnerCalledFunctions(input.state.checker, input.callback).some((function_) =>
    functionReturnsParameter({ ...input, function_ }),
  );

const receiverContainsOwnerElement = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  return receiver !== null && expressionContainsOwnerElement(input.state, receiver);
};

const preservedArrayContainsOwner = (input: {
  readonly call: ts.CallExpression;
  readonly name: string | null;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  (input.name === "slice" || input.name === "filter") && receiverContainsOwnerElement(input);

const mappedArrayContainsOwner = (input: {
  readonly call: ts.CallExpression;
  readonly name: string | null;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  input.name === "map" &&
  receiverContainsOwnerElement(input) &&
  identityCallback({ callback: input.call.arguments[0], state: input.state });

const concatenatedArrayContainsOwner = (input: {
  readonly call: ts.CallExpression;
  readonly name: string | null;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  input.name === "concat" &&
  (receiverContainsOwnerElement(input) ||
    input.call.arguments.some((argument) => expressionContainsOwnerElement(input.state, argument)));

const staticArrayContainsOwner = (input: {
  readonly call: ts.CallExpression;
  readonly name: string | null;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const source = input.call.arguments[0];
  return (
    input.name === "from" &&
    source !== undefined &&
    expressionContainsOwnerElement(input.state, source)
  );
};

const objectValuesContainOwner = (input: {
  readonly call: ts.CallExpression;
  readonly name: string | null;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const source = input.call.arguments[0];
  return (
    input.name === "values" &&
    source !== undefined &&
    expressionContainsOwnerProperty(input.state, source)
  );
};

const derivedArrayContainsOwner = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  if (!canonicalOwnerExpressionIsDefaultLibrary(input.state, input.call.expression)) return false;
  const name = canonicalOwnerMemberName(input.call.expression);
  return [
    preservedArrayContainsOwner({ ...input, name }),
    mappedArrayContainsOwner({ ...input, name }),
    concatenatedArrayContainsOwner({ ...input, name }),
    staticArrayContainsOwner({ ...input, name }),
    objectValuesContainOwner({ ...input, name }),
  ].some(Boolean);
};

const constructedCollectionContainsOwner = (input: {
  readonly expression: ts.NewExpression;
  readonly state: CanonicalOwnerAliasState;
}): "array" | "map" | null => {
  const constructor = input.expression.expression;
  const source = input.expression.arguments?.[0];
  if (source === undefined || !canonicalOwnerExpressionIsDefaultLibrary(input.state, constructor)) {
    return null;
  }
  if (
    canonicalOwnerGlobalIdentifierIs({ identifier: constructor, name: "Set", state: input.state })
  ) {
    return expressionContainsOwnerElement(input.state, source) ? "array" : null;
  }
  const current = unwrapCanonicalOwnerExpression(constructor);
  return ts.isIdentifier(current) &&
    (current.text === "Map" || current.text === "WeakMap") &&
    expressionContainsOwnerElement(input.state, source)
    ? "map"
    : null;
};

export const addCanonicalOwnerConstructedContainerOrigin = (input: {
  readonly initializer: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Identifier;
}): boolean => {
  const current = unwrapCanonicalOwnerExpression(input.initializer);
  const kind = ts.isCallExpression(current)
    ? derivedArrayContainsOwner({ ...input, call: current })
      ? "array"
      : null
    : ts.isNewExpression(current)
      ? constructedCollectionContainsOwner({ ...input, expression: current })
      : null;
  return kind === null
    ? false
    : addCanonicalOwnerExpressionAddress({
        expression: input.target,
        state: input.state,
        suffix: [kind === "array" ? CANONICAL_OWNER_ARRAY_ELEMENT : CANONICAL_OWNER_MAP_VALUE],
      });
};
