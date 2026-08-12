import * as ts from "typescript-6";

import {
  addCanonicalOwnerExpressionAddress,
  CANONICAL_OWNER_ARRAY_ELEMENT,
  CANONICAL_OWNER_MAP_VALUE,
  canonicalOwnerExpressionKey,
  canonicalOwnerReferenceKey,
  canonicalOwnerPropertyKey,
  copyCanonicalOwnerAddresses,
} from "./canonical-owner-address.ts";
import { canonicalOwnerExpressionIsOwner } from "./canonical-owner-expression.ts";
import {
  canonicalOwnerExpressionIsDefaultLibrary,
  canonicalOwnerGlobalIdentifierIs,
} from "./canonical-owner-standard.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";

const addOwnerAddress = (input: {
  readonly path: string;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Expression;
}): boolean =>
  addCanonicalOwnerExpressionAddress({
    expression: input.target,
    state: input.state,
    suffix: [input.path],
  });

const ownerArguments = (
  state: CanonicalOwnerAliasState,
  arguments_: readonly ts.Expression[],
): boolean =>
  arguments_.some((argument) => canonicalOwnerExpressionIsOwner({ expression: argument, state }));

const arrayWriteAddsOrigin = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  if (!canonicalOwnerExpressionIsDefaultLibrary(input.state, input.call.expression)) return false;
  const name = canonicalOwnerMemberName(input.call.expression);
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  if (receiver === null) return false;
  const inserted =
    name === "push" || name === "unshift"
      ? input.call.arguments
      : name === "splice"
        ? input.call.arguments.slice(2)
        : [];
  return ownerArguments(input.state, inserted)
    ? addOwnerAddress({ ...input, path: CANONICAL_OWNER_ARRAY_ELEMENT, target: receiver })
    : false;
};

const setAddOrigin = (input: {
  readonly first: ts.Expression | undefined;
  readonly name: string | null;
  readonly receiver: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  input.name === "add" &&
  input.first !== undefined &&
  canonicalOwnerExpressionIsOwner({ expression: input.first, state: input.state }) &&
  addOwnerAddress({
    ...input,
    path: CANONICAL_OWNER_ARRAY_ELEMENT,
    target: input.receiver,
  });

const mapSetOrigin = (input: {
  readonly call: ts.CallExpression;
  readonly name: string | null;
  readonly receiver: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const first = input.call.arguments[0];
  const owner = input.call.arguments[1];
  const key = first === undefined ? null : canonicalOwnerReferenceKey(input.state, first);
  if (
    input.name !== "set" ||
    owner === undefined ||
    key === null ||
    !canonicalOwnerExpressionIsOwner({ expression: owner, state: input.state })
  ) {
    return false;
  }
  return [
    addOwnerAddress({ ...input, path: `$map:${key}`, target: input.receiver }),
    addOwnerAddress({ ...input, path: CANONICAL_OWNER_MAP_VALUE, target: input.receiver }),
  ].some(Boolean);
};

const collectionWriteAddsOrigin = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  if (!canonicalOwnerExpressionIsDefaultLibrary(input.state, input.call.expression)) return false;
  const name = canonicalOwnerMemberName(input.call.expression);
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  if (receiver === null) return false;
  return [
    setAddOrigin({ first: input.call.arguments[0], name, receiver, state: input.state }),
    mapSetOrigin({ ...input, name, receiver }),
  ].some(Boolean);
};

const objectLiteralSourceAddsOrigins = (input: {
  readonly object: ts.ObjectLiteralExpression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Expression;
}): boolean =>
  input.object.properties
    .map((property) => {
      if (ts.isSpreadAssignment(property)) {
        return copyCanonicalOwnerAddresses({
          source: property.expression,
          state: input.state,
          target: input.target,
        });
      }
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
        return false;
      }
      const key = canonicalOwnerPropertyKey(input.state, property.name);
      const propertyExpression = ts.isPropertyAssignment(property)
        ? property.initializer
        : property.name;
      return key !== null &&
        canonicalOwnerExpressionIsOwner({ expression: propertyExpression, state: input.state })
        ? addOwnerAddress({ ...input, path: key })
        : false;
    })
    .some(Boolean);

const objectSourceAddsOrigins = (input: {
  readonly source: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Expression;
}): boolean => {
  const current = unwrapCanonicalOwnerExpression(input.source);
  return ts.isObjectLiteralExpression(current)
    ? objectLiteralSourceAddsOrigins({ ...input, object: current })
    : copyCanonicalOwnerAddresses(input);
};

const globalObjectCall = (input: {
  readonly call: ts.CallExpression;
  readonly method: string;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  return (
    canonicalOwnerMemberName(input.call.expression) === input.method &&
    receiver !== null &&
    canonicalOwnerGlobalIdentifierIs({ identifier: receiver, name: "Object", state: input.state })
  );
};

const objectAssignAddsOrigins = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const target = input.call.arguments[0];
  return target !== undefined && globalObjectCall({ ...input, method: "assign" })
    ? input.call.arguments
        .slice(1)
        .map((source) => objectSourceAddsOrigins({ ...input, source, target }))
        .some(Boolean)
    : false;
};

const descriptorValue = (expression: ts.Expression): ts.Expression | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (!ts.isObjectLiteralExpression(current)) return null;
  const property = current.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      canonicalOwnerPropertyKeyText(candidate.name) === "value",
  );
  return property !== undefined && ts.isPropertyAssignment(property) ? property.initializer : null;
};

const canonicalOwnerPropertyKeyText = (name: ts.PropertyName): string | null =>
  ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
    ? name.text
    : null;

const definePropertyAddsOrigin = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const target = input.call.arguments[0];
  const keyExpression = input.call.arguments[1];
  const descriptor = input.call.arguments[2];
  const key =
    keyExpression === undefined ? null : canonicalOwnerExpressionKey(input.state, keyExpression);
  const origin = descriptor === undefined ? null : descriptorValue(descriptor);
  return target !== undefined &&
    key !== null &&
    origin !== null &&
    globalObjectCall({ ...input, method: "defineProperty" }) &&
    canonicalOwnerExpressionIsOwner({ expression: origin, state: input.state })
    ? addOwnerAddress({ ...input, path: key, target })
    : false;
};

export const addCanonicalOwnerContainerWriteOrigins = (
  state: CanonicalOwnerAliasState,
  node: ts.Node,
): boolean =>
  ts.isCallExpression(node) &&
  [
    arrayWriteAddsOrigin({ call: node, state }),
    collectionWriteAddsOrigin({ call: node, state }),
    objectAssignAddsOrigins({ call: node, state }),
    definePropertyAddsOrigin({ call: node, state }),
  ].some(Boolean);
