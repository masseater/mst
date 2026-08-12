import * as ts from "typescript-6";

import { canonicalOwnerExpressionIsDefaultLibrary } from "./canonical-owner-standard.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  canonicalOwnerSymbolIs,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

type CanonicalOwnerAddress = {
  readonly path: readonly string[];
  readonly root: ts.Symbol;
};

export const CANONICAL_OWNER_ARRAY_ELEMENT = "$element";
export const CANONICAL_OWNER_MAP_VALUE = "$map-value";

const pathKey = (path: readonly string[]): string => JSON.stringify(path);

const literalTypeKey = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): string | null => {
  const type = state.checker.getTypeAtLocation(expression);
  if ((type.flags & ts.TypeFlags.StringLiteral) !== 0) {
    return (type as ts.StringLiteralType).value;
  }
  if ((type.flags & ts.TypeFlags.NumberLiteral) !== 0) {
    return String((type as ts.NumberLiteralType).value);
  }
  if ((type.flags & ts.TypeFlags.BooleanLiteral) !== 0) {
    return state.checker.typeToString(type);
  }
  return null;
};

const symbolTypeKey = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): string | null => {
  const type = state.checker.getTypeAtLocation(expression);
  if ((type.flags & ts.TypeFlags.ESSymbolLike) === 0) return null;
  const symbol = state.checker.getSymbolAtLocation(unwrapCanonicalOwnerExpression(expression));
  const declaration = symbol?.declarations?.at(0);
  return declaration === undefined
    ? null
    : `$symbol:${declaration.getSourceFile().fileName}:${declaration.pos}`;
};

const staticKey = (state: CanonicalOwnerAliasState, expression: ts.Expression): string | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (ts.isStringLiteralLike(current) || ts.isNumericLiteral(current)) return current.text;
  if (ts.isNoSubstitutionTemplateLiteral(current)) return current.text;
  if (current.kind === ts.SyntaxKind.TrueKeyword) return "true";
  if (current.kind === ts.SyntaxKind.FalseKeyword) return "false";
  return literalTypeKey(state, current) ?? symbolTypeKey(state, current);
};

export const canonicalOwnerExpressionKey = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): string | null => staticKey(state, expression);

export const canonicalOwnerReferenceKey = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): string | null => {
  const direct = staticKey(state, expression);
  if (direct !== null) return direct;
  const current = unwrapCanonicalOwnerExpression(expression);
  if (!ts.isIdentifier(current)) return null;
  const symbol = state.checker.getSymbolAtLocation(current);
  const declaration = symbol?.declarations?.at(0);
  return declaration === undefined
    ? null
    : `$reference:${declaration.getSourceFile().fileName}:${declaration.pos}`;
};

export const canonicalOwnerPropertyKey = (
  state: CanonicalOwnerAliasState,
  name: ts.PropertyName,
): string | null => {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
  return ts.isComputedPropertyName(name) ? staticKey(state, name.expression) : null;
};

export const canonicalOwnerPropertyName = (name: ts.PropertyName): string | null => {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
  if (!ts.isComputedPropertyName(name)) return null;
  const current = unwrapCanonicalOwnerExpression(name.expression);
  return ts.isStringLiteralLike(current) || ts.isNumericLiteral(current) ? current.text : null;
};

const identifierAddress = (
  state: CanonicalOwnerAliasState,
  identifier: ts.Identifier,
): CanonicalOwnerAddress | null => {
  const symbol = state.checker.getSymbolAtLocation(identifier);
  return symbol === undefined
    ? null
    : { path: [], root: resolveTypeScriptSymbol(state.checker, symbol) };
};

const memberAddress = (
  state: CanonicalOwnerAliasState,
  expression: ts.PropertyAccessExpression | ts.ElementAccessExpression,
): CanonicalOwnerAddress | null => {
  const receiver = canonicalOwnerExpressionAddress(state, expression.expression);
  const key = ts.isPropertyAccessExpression(expression)
    ? expression.name.text
    : staticKey(state, expression.argumentExpression);
  return receiver === null || key === null
    ? null
    : { path: [...receiver.path, key], root: receiver.root };
};

const canonicalOwnerExpressionAddress = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): CanonicalOwnerAddress | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (ts.isIdentifier(current)) return identifierAddress(state, current);
  return ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)
    ? memberAddress(state, current)
    : null;
};

const canonicalOwnerAddressIsOwner = (
  state: CanonicalOwnerAliasState,
  address: CanonicalOwnerAddress | null,
): boolean =>
  address !== null && (state.addresses.get(address.root)?.has(pathKey(address.path)) ?? false);

const descendantOwnerPaths = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): readonly string[][] => {
  const address = canonicalOwnerExpressionAddress(state, expression);
  if (address === null) return [];
  return [...(state.addresses.get(address.root) ?? [])].flatMap((encodedPath) => {
    const path = JSON.parse(encodedPath) as string[];
    const descendant =
      path.length > address.path.length &&
      address.path.every((segment, index) => path[index] === segment);
    return descendant ? [path.slice(address.path.length)] : [];
  });
};

const directOwnerReference = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean =>
  canonicalOwnerSymbolIs(state, canonicalOwnerSymbolAtExpression(state.checker, expression)) ||
  canonicalOwnerExpressionAddressIsOwner({ expression, state });

const arrayLiteralHasOwner = (
  state: CanonicalOwnerAliasState,
  array: ts.ArrayLiteralExpression,
): boolean =>
  array.elements.some((element) => {
    if (ts.isOmittedExpression(element)) return false;
    return ts.isSpreadElement(element)
      ? arrayExpressionHasOwner(state, element.expression)
      : directOwnerReference(state, element);
  });

const receiverArrayHasOwner = (input: {
  readonly call: ts.CallExpression;
  readonly names: ReadonlySet<string>;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  if (!input.names.has(canonicalOwnerMemberName(input.call.expression) ?? "")) return false;
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  return receiver !== null && arrayExpressionHasOwner(input.state, receiver);
};

const concatenatedArrayHasOwner = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  receiverArrayHasOwner({ ...input, names: new Set(["concat"]) }) ||
  (canonicalOwnerMemberName(input.call.expression) === "concat" &&
    input.call.arguments.some((argument) => arrayExpressionHasOwner(input.state, argument)));

const staticArrayHasOwner = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const source = input.call.arguments[0];
  return (
    canonicalOwnerMemberName(input.call.expression) === "from" &&
    source !== undefined &&
    arrayExpressionHasOwner(input.state, source)
  );
};

const objectValuesHaveOwner = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const source = input.call.arguments[0];
  return (
    canonicalOwnerMemberName(input.call.expression) === "values" &&
    source !== undefined &&
    canonicalOwnerExpressionPropertyValueIsOwner({ expression: source, state: input.state })
  );
};

const derivedArrayCallHasOwner = (
  state: CanonicalOwnerAliasState,
  call: ts.CallExpression,
): boolean => {
  if (!canonicalOwnerExpressionIsDefaultLibrary(state, call.expression)) return false;
  return [
    receiverArrayHasOwner({ call, names: new Set(["slice", "filter"]), state }),
    concatenatedArrayHasOwner({ call, state }),
    staticArrayHasOwner({ call, state }),
    objectValuesHaveOwner({ call, state }),
  ].some(Boolean);
};

const arrayExpressionHasOwner = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (ts.isArrayLiteralExpression(current)) return arrayLiteralHasOwner(state, current);
  if (ts.isCallExpression(current)) return derivedArrayCallHasOwner(state, current);
  return descendantOwnerPaths(state, current).some(
    (path) =>
      path.length === 1 &&
      (path[0] === CANONICAL_OWNER_ARRAY_ELEMENT || /^(?:0|[1-9]\d*)$/u.test(path[0] ?? "")),
  );
};

export const canonicalOwnerExpressionArrayElementIsOwner = (input: {
  readonly expression: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => arrayExpressionHasOwner(input.state, input.expression);

export const canonicalOwnerExpressionMapValueIsOwner = (input: {
  readonly expression: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  descendantOwnerPaths(input.state, input.expression).some(
    (path) =>
      path.length === 1 &&
      (path[0] === CANONICAL_OWNER_MAP_VALUE || path[0]?.startsWith("$map:") === true),
  );

export const canonicalOwnerExpressionPropertyValueIsOwner = (input: {
  readonly expression: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  if (ts.isObjectLiteralExpression(current)) {
    return current.properties.some((property) => {
      if (ts.isSpreadAssignment(property)) {
        return canonicalOwnerExpressionPropertyValueIsOwner({
          expression: property.expression,
          state: input.state,
        });
      }
      if (ts.isPropertyAssignment(property)) {
        return directOwnerReference(input.state, property.initializer);
      }
      return (
        ts.isShorthandPropertyAssignment(property) &&
        directOwnerReference(input.state, property.name)
      );
    });
  }
  return descendantOwnerPaths(input.state, current).some((path) => path.length === 1);
};

export const canonicalOwnerExpressionAddressIsOwner = (input: {
  readonly expression: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
  readonly suffix?: readonly string[];
}): boolean => {
  const address = canonicalOwnerExpressionAddress(input.state, input.expression);
  return (
    address !== null &&
    canonicalOwnerAddressIsOwner(input.state, {
      path: [...address.path, ...(input.suffix ?? [])],
      root: address.root,
    })
  );
};

const addCanonicalOwnerAddress = (
  state: CanonicalOwnerAliasState,
  address: CanonicalOwnerAddress | null,
): boolean => {
  if (address === null) return false;
  const paths = state.addresses.get(address.root) ?? new Set<string>();
  const key = pathKey(address.path);
  if (paths.has(key)) return false;
  paths.add(key);
  state.addresses.set(address.root, paths);
  return true;
};

export const addCanonicalOwnerExpressionAddress = (input: {
  readonly expression: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
  readonly suffix?: readonly string[];
}): boolean => {
  const address = canonicalOwnerExpressionAddress(input.state, input.expression);
  return addCanonicalOwnerAddress(
    input.state,
    address === null
      ? null
      : { path: [...address.path, ...(input.suffix ?? [])], root: address.root },
  );
};

const inheritedAddress = (input: {
  readonly encodedPath: string;
  readonly source: CanonicalOwnerAddress;
  readonly state: CanonicalOwnerAliasState;
  readonly target: CanonicalOwnerAddress;
}): boolean => {
  const path = JSON.parse(input.encodedPath) as string[];
  const inheritsSource =
    path.length >= input.source.path.length &&
    input.source.path.every((segment, index) => path[index] === segment);
  return inheritsSource
    ? addCanonicalOwnerAddress(input.state, {
        path: [...input.target.path, ...path.slice(input.source.path.length)],
        root: input.target.root,
      })
    : false;
};

export const copyCanonicalOwnerAddresses = (input: {
  readonly source: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Expression;
}): boolean => {
  const source = canonicalOwnerExpressionAddress(input.state, input.source);
  const target = canonicalOwnerExpressionAddress(input.state, input.target);
  if (source === null || target === null) return false;
  const sourcePaths = input.state.addresses.get(source.root);
  return sourcePaths === undefined
    ? false
    : [...sourcePaths]
        .map((encodedPath) => inheritedAddress({ encodedPath, source, state: input.state, target }))
        .some(Boolean);
};
