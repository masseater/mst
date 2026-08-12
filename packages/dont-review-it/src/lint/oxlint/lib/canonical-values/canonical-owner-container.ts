import * as ts from "typescript-6";

import {
  addCanonicalOwnerExpressionAddress,
  CANONICAL_OWNER_MAP_VALUE,
  canonicalOwnerExpressionAddressIsOwner,
  canonicalOwnerReferenceKey,
  canonicalOwnerPropertyKey,
  copyCanonicalOwnerAddresses,
} from "./canonical-owner-address.ts";
import { addCanonicalOwnerConstructedContainerOrigin } from "./canonical-owner-container-construction.ts";
import { canonicalOwnerExpressionIsOwner } from "./canonical-owner-expression.ts";
import {
  addCanonicalOwnerSymbol,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";

const arrayBindingSource = (
  element: ts.BindingElement,
  source: ts.Expression,
): ts.Expression | null => {
  const pattern = element.parent;
  const current = unwrapCanonicalOwnerExpression(source);
  if (!ts.isArrayBindingPattern(pattern) || !ts.isArrayLiteralExpression(current)) return null;
  const candidate = current.elements[pattern.elements.indexOf(element)];
  return candidate === undefined || ts.isOmittedExpression(candidate) ? null : candidate;
};

const objectBindingSource = (
  element: ts.BindingElement,
  source: ts.Expression,
): ts.Expression | null => {
  const pattern = element.parent;
  const current = unwrapCanonicalOwnerExpression(source);
  if (!ts.isObjectBindingPattern(pattern) || !ts.isObjectLiteralExpression(current)) return null;
  const propertyName = element.propertyName ?? element.name;
  if (!ts.isIdentifier(propertyName) && !ts.isStringLiteralLike(propertyName)) return null;
  const matching = current.properties.find(
    (property) =>
      (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
      property.name.getText() === propertyName.getText(),
  );
  if (matching === undefined) return null;
  if (ts.isPropertyAssignment(matching)) return matching.initializer;
  return ts.isShorthandPropertyAssignment(matching) ? matching.name : null;
};

const bindingElementKey = (input: {
  readonly element: ts.BindingElement;
  readonly index: number;
  readonly pattern: ts.ArrayBindingPattern | ts.ObjectBindingPattern;
  readonly state: CanonicalOwnerAliasState;
}): string | null => {
  if (ts.isArrayBindingPattern(input.pattern)) return String(input.index);
  const propertyName =
    input.element.propertyName ?? (ts.isIdentifier(input.element.name) ? input.element.name : null);
  return propertyName === null ? null : canonicalOwnerPropertyKey(input.state, propertyName);
};

const addBindingElementAlias = (input: {
  readonly element: ts.BindingElement;
  readonly index: number;
  readonly pattern: ts.ArrayBindingPattern | ts.ObjectBindingPattern;
  readonly source: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const directSource =
    arrayBindingSource(input.element, input.source) ??
    objectBindingSource(input.element, input.source);
  if (directSource !== null) {
    return addCanonicalOwnerBindingAliases({
      name: input.element.name,
      source: directSource,
      state: input.state,
    });
  }
  const key = bindingElementKey(input);
  if (
    key === null ||
    !ts.isIdentifier(input.element.name) ||
    !canonicalOwnerExpressionAddressIsOwner({
      expression: input.source,
      state: input.state,
      suffix: [key],
    })
  ) {
    return false;
  }
  return addCanonicalOwnerSymbol(
    input.state,
    input.state.checker.getSymbolAtLocation(input.element.name),
  );
};

export const addCanonicalOwnerBindingAliases = (input: {
  readonly name: ts.BindingName;
  readonly source: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  if (ts.isIdentifier(input.name)) {
    return canonicalOwnerExpressionIsOwner({ expression: input.source, state: input.state })
      ? addCanonicalOwnerSymbol(input.state, input.state.checker.getSymbolAtLocation(input.name))
      : false;
  }
  return input.name.elements
    .map((element, index) =>
      ts.isOmittedExpression(element)
        ? false
        : addBindingElementAlias({
            element,
            index,
            pattern: input.name as ts.ArrayBindingPattern | ts.ObjectBindingPattern,
            source: input.source,
            state: input.state,
          }),
    )
    .some(Boolean);
};

const addArrayAddresses = (input: {
  readonly initializer: ts.ArrayLiteralExpression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Identifier;
}): boolean =>
  input.initializer.elements
    .map((element, index) =>
      !ts.isOmittedExpression(element) &&
      !ts.isSpreadElement(element) &&
      canonicalOwnerExpressionIsOwner({ expression: element, state: input.state })
        ? addCanonicalOwnerExpressionAddress({
            expression: input.target,
            state: input.state,
            suffix: [String(index)],
          })
        : false,
    )
    .some(Boolean);

const addObjectPropertyAddress = (input: {
  readonly property: ts.ObjectLiteralElementLike;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Identifier;
}): boolean => {
  if (ts.isSpreadAssignment(input.property)) {
    return copyCanonicalOwnerAddresses({
      source: input.property.expression,
      state: input.state,
      target: input.target,
    });
  }
  if (
    !ts.isPropertyAssignment(input.property) &&
    !ts.isShorthandPropertyAssignment(input.property)
  ) {
    return false;
  }
  const key = canonicalOwnerPropertyKey(input.state, input.property.name);
  const propertyExpression = ts.isPropertyAssignment(input.property)
    ? input.property.initializer
    : input.property.name;
  return key !== null &&
    canonicalOwnerExpressionIsOwner({ expression: propertyExpression, state: input.state })
    ? addCanonicalOwnerExpressionAddress({
        expression: input.target,
        state: input.state,
        suffix: [key],
      })
    : false;
};

const addObjectAddresses = (input: {
  readonly initializer: ts.ObjectLiteralExpression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Identifier;
}): boolean =>
  input.initializer.properties
    .map((property) => addObjectPropertyAddress({ ...input, property }))
    .some(Boolean);

const mapEntryKey = (state: CanonicalOwnerAliasState, entry: ts.Expression): string | null => {
  const pair = unwrapCanonicalOwnerExpression(entry);
  if (!ts.isArrayLiteralExpression(pair)) return null;
  const key = pair.elements.at(0);
  return key !== undefined && !ts.isSpreadElement(key) && !ts.isOmittedExpression(key)
    ? canonicalOwnerReferenceKey(state, key)
    : null;
};

const mapEntryValue = (entry: ts.Expression): ts.Expression | null => {
  const pair = unwrapCanonicalOwnerExpression(entry);
  if (!ts.isArrayLiteralExpression(pair)) return null;
  const propertyExpression = pair.elements.at(1);
  return propertyExpression === undefined ||
    ts.isSpreadElement(propertyExpression) ||
    ts.isOmittedExpression(propertyExpression)
    ? null
    : propertyExpression;
};

const mapEntryAddress = (input: {
  readonly entry: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Identifier;
}): boolean => {
  const key = mapEntryKey(input.state, input.entry);
  const propertyExpression = mapEntryValue(input.entry);
  if (
    key === null ||
    propertyExpression === null ||
    !canonicalOwnerExpressionIsOwner({ expression: propertyExpression, state: input.state })
  ) {
    return false;
  }
  return [
    addCanonicalOwnerExpressionAddress({
      expression: input.target,
      state: input.state,
      suffix: [`$map:${key}`],
    }),
    addCanonicalOwnerExpressionAddress({
      expression: input.target,
      state: input.state,
      suffix: [CANONICAL_OWNER_MAP_VALUE],
    }),
  ].some(Boolean);
};

const addMapAddresses = (input: {
  readonly initializer: ts.NewExpression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Identifier;
}): boolean => {
  const constructor = input.initializer.expression.getText();
  if (constructor !== "Map" && constructor !== "WeakMap") return false;
  const entries = input.initializer.arguments?.[0];
  const current = entries === undefined ? null : unwrapCanonicalOwnerExpression(entries);
  return current !== null && ts.isArrayLiteralExpression(current)
    ? current.elements.map((entry) => mapEntryAddress({ ...input, entry })).some(Boolean)
    : false;
};

export const addCanonicalOwnerContainerAddresses = (
  state: CanonicalOwnerAliasState,
  node: ts.Node,
): boolean => {
  if (
    !ts.isVariableDeclaration(node) ||
    !ts.isIdentifier(node.name) ||
    node.initializer === undefined
  ) {
    return false;
  }
  const initializer = unwrapCanonicalOwnerExpression(node.initializer);
  if (ts.isArrayLiteralExpression(initializer)) {
    return addArrayAddresses({ initializer, state, target: node.name });
  }
  if (ts.isObjectLiteralExpression(initializer)) {
    return addObjectAddresses({ initializer, state, target: node.name });
  }
  return [
    ts.isNewExpression(initializer)
      ? addMapAddresses({ initializer, state, target: node.name })
      : false,
    addCanonicalOwnerConstructedContainerOrigin({
      initializer,
      state,
      target: node.name,
    }),
  ].some(Boolean);
};
