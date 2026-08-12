import { groupBy, uniqBy } from "es-toolkit";
import * as ts from "typescript-6";

import { canonicalValueKey, type CanonicalValue } from "./fingerprint.ts";

type DirectObjectProperty = {
  readonly kind: "get" | "set" | "value";
  readonly name: string;
};

type ValueSequences = readonly (readonly CanonicalValue[])[];
type PropertySequences = readonly (readonly DirectObjectProperty[])[];
type DuplicateResolution = {
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
};

const unwrapInitializer = (expression: ts.Expression): ts.Expression => {
  if (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrapInitializer(expression.expression);
  }
  return expression;
};

const signedPrimitive = (expression: ts.PrefixUnaryExpression): number | undefined => {
  const operand = initializerPrimitive(expression.operand);
  if (typeof operand !== "number") return undefined;
  if (expression.operator === ts.SyntaxKind.MinusToken) return -operand;
  return expression.operator === ts.SyntaxKind.PlusToken ? operand : undefined;
};

const initializerPrimitive = (expression: ts.Expression): CanonicalValue | undefined => {
  const unwrapped = unwrapInitializer(expression);
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }
  if (ts.isNumericLiteral(unwrapped)) return Number(unwrapped.text);
  if (ts.isPrefixUnaryExpression(unwrapped)) return signedPrimitive(unwrapped);
  if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) return false;
  return unwrapped.kind === ts.SyntaxKind.NullKeyword ? null : undefined;
};

export const canonicalValueFromLiteralType = (
  checker: ts.TypeChecker,
  type: ts.Type,
): CanonicalValue | undefined => {
  if ((type.flags & ts.TypeFlags.StringLiteral) !== 0) return (type as ts.StringLiteralType).value;
  if ((type.flags & ts.TypeFlags.NumberLiteral) !== 0) return (type as ts.NumberLiteralType).value;
  if ((type.flags & ts.TypeFlags.BooleanLiteral) !== 0)
    return checker.typeToString(type) === "true";
  return (type.flags & ts.TypeFlags.Null) !== 0 ? null : undefined;
};

const directObjectPropertyName = (
  checker: ts.TypeChecker,
  name: ts.PropertyName | undefined,
): string | undefined => {
  if (name === undefined || ts.isPrivateIdentifier(name)) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isNumericLiteral(name)) return String(Number(name.text));
  if (!ts.isComputedPropertyName(name)) return undefined;
  const canonicalItem =
    initializerPrimitive(name.expression) ??
    canonicalValueFromLiteralType(checker, checker.getTypeAtLocation(name.expression));
  return typeof canonicalItem === "string" || typeof canonicalItem === "number"
    ? String(canonicalItem)
    : undefined;
};

const directObjectProperty = (
  checker: ts.TypeChecker,
  element: ts.ObjectLiteralElementLike,
): DirectObjectProperty | undefined => {
  if (ts.isSpreadAssignment(element)) return undefined;
  const name = directObjectPropertyName(checker, element.name);
  if (name === undefined) return undefined;
  const kind = ts.isGetAccessorDeclaration(element)
    ? "get"
    : ts.isSetAccessorDeclaration(element)
      ? "set"
      : "value";
  return { kind, name };
};

const hasInvalidObjectDuplicate = (properties: readonly DirectObjectProperty[]): boolean =>
  Object.values(groupBy(properties, (property) => property.name)).some((sameName) => {
    if (sameName.length < 2) return false;
    return !(
      sameName.length === 2 &&
      sameName.some((property) => property.kind === "get") &&
      sameName.some((property) => property.kind === "set")
    );
  });

const appendValueAlternatives = (
  prefixes: ValueSequences,
  alternatives: readonly CanonicalValue[],
): ValueSequences => prefixes.flatMap((prefix) => alternatives.map((value) => [...prefix, value]));

const appendValueSequences = (prefixes: ValueSequences, suffixes: ValueSequences): ValueSequences =>
  prefixes.flatMap((prefix) => suffixes.map((suffix) => [...prefix, ...suffix]));

const appendPropertySequences = (
  prefixes: PropertySequences,
  suffixes: PropertySequences,
): PropertySequences =>
  prefixes.flatMap((prefix) => suffixes.map((suffix) => [...prefix, ...suffix]));

const literalAlternatives = (
  checker: ts.TypeChecker,
  type: ts.Type,
): readonly CanonicalValue[] | null => {
  const memberTypes = type.isUnion() ? type.types : [type];
  const canonicalItems = memberTypes.map((member) =>
    canonicalValueFromLiteralType(checker, member),
  );
  if (canonicalItems.some((canonicalItem) => canonicalItem === undefined)) return null;
  return uniqBy(canonicalItems as readonly CanonicalValue[], canonicalValueKey);
};

const expressionLiteralAlternatives = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): readonly CanonicalValue[] | null => {
  const primitive = initializerPrimitive(expression);
  return primitive === undefined
    ? literalAlternatives(checker, checker.getTypeAtLocation(expression))
    : [primitive];
};

const tupleValueSequences = (checker: ts.TypeChecker, type: ts.Type): ValueSequences | null => {
  if (!checker.isTupleType(type)) return null;
  const tuple = type as ts.TupleTypeReference;
  if (tuple.target.elementFlags.some((flag) => flag !== ts.ElementFlags.Required)) return null;
  return checker.getTypeArguments(tuple).reduce<ValueSequences | null>(
    (sequences, elementType) => {
      if (sequences === null) return null;
      const alternatives = literalAlternatives(checker, elementType);
      if (alternatives === null) return null;
      return appendValueAlternatives(sequences, alternatives);
    },
    [[]],
  );
};

const typeTupleSequences = (checker: ts.TypeChecker, type: ts.Type): ValueSequences | null => {
  const memberTypes = type.isUnion() ? type.types : [type];
  const sequences = memberTypes.map((member) => tupleValueSequences(checker, member));
  if (sequences.some((candidate) => candidate === null)) return null;
  return sequences.flatMap((candidate) => candidate as ValueSequences);
};

const arrayElementSequences = (
  checker: ts.TypeChecker,
  element: ts.Expression,
): ValueSequences | null => {
  if (ts.isSpreadElement(element)) return arrayExpressionSequences(checker, element.expression);
  const alternatives = expressionLiteralAlternatives(checker, element);
  return alternatives === null ? null : alternatives.map((alternative) => [alternative]);
};

const arrayLiteralSequences = (
  checker: ts.TypeChecker,
  initializer: ts.ArrayLiteralExpression,
): ValueSequences | null =>
  initializer.elements.reduce<ValueSequences | null>(
    (sequences, element) => {
      if (sequences === null) return null;
      const elementSequences = arrayElementSequences(checker, element);
      return elementSequences === null ? null : appendValueSequences(sequences, elementSequences);
    },
    [[]],
  );

const arrayExpressionSequences = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): ValueSequences | null => {
  const unwrapped = unwrapInitializer(expression);
  if (ts.isArrayLiteralExpression(unwrapped)) return arrayLiteralSequences(checker, unwrapped);
  return typeTupleSequences(checker, checker.getTypeAtLocation(unwrapped));
};

const staticObjectProperties = (
  checker: ts.TypeChecker,
  type: ts.Type,
): readonly DirectObjectProperty[] | null => {
  if (checker.getIndexInfosOfType(type).length > 0) return null;
  const properties = checker.getPropertiesOfType(type);
  if (properties.some((property) => (property.flags & ts.SymbolFlags.Optional) !== 0)) return null;
  const names = properties.map((property) => property.name);
  if (names.some((name) => name.startsWith("__@"))) return null;
  if (names.length === 0) return null;
  return names.map((name) => ({ kind: "value", name }));
};

const typeObjectSequences = (checker: ts.TypeChecker, type: ts.Type): PropertySequences | null => {
  const memberTypes = type.isUnion() ? type.types : [type];
  const candidates = memberTypes.map((member) => staticObjectProperties(checker, member));
  if (candidates.some((candidate) => candidate === null)) return null;
  return candidates.map((candidate) => candidate as readonly DirectObjectProperty[]);
};

const collapsedSpreadProperties = (properties: readonly DirectObjectProperty[]) =>
  uniqBy(properties, (property) => property.name).map(({ name }) => ({
    kind: "value" as const,
    name,
  }));

const objectExpressionSequences = (
  resolution: DuplicateResolution,
  expression: ts.Expression,
): PropertySequences | null => {
  const unwrapped = unwrapInitializer(expression);
  if (ts.isObjectLiteralExpression(unwrapped)) return objectLiteralSequences(resolution, unwrapped);
  if (ts.isConditionalExpression(unwrapped))
    return conditionalObjectSequences(resolution, unwrapped);
  if (ts.isIdentifier(unwrapped)) return identifierObjectSequences(resolution, unwrapped);
  return typeObjectSequences(resolution.checker, resolution.checker.getTypeAtLocation(unwrapped));
};

const conditionalObjectSequences = (
  resolution: DuplicateResolution,
  expression: ts.ConditionalExpression,
): PropertySequences | null => {
  const whenTrue = objectExpressionSequences(resolution, expression.whenTrue);
  const whenFalse = objectExpressionSequences(resolution, expression.whenFalse);
  return whenTrue === null || whenFalse === null ? null : [...whenTrue, ...whenFalse];
};

const identifierObjectSequences = (
  resolution: DuplicateResolution,
  identifier: ts.Identifier,
): PropertySequences | null => {
  const unresolvedSymbol = resolution.checker.getSymbolAtLocation(identifier);
  const symbol =
    unresolvedSymbol !== undefined && (unresolvedSymbol.flags & ts.SymbolFlags.Alias) !== 0
      ? resolution.checker.getAliasedSymbol(unresolvedSymbol)
      : unresolvedSymbol;
  const declaration = symbol?.valueDeclaration;
  if (
    symbol === undefined ||
    resolution.seenSymbols.has(symbol) ||
    declaration === undefined ||
    !ts.isVariableDeclaration(declaration) ||
    declaration.initializer === undefined
  ) {
    return typeObjectSequences(
      resolution.checker,
      resolution.checker.getTypeAtLocation(identifier),
    );
  }
  return objectExpressionSequences(
    { ...resolution, seenSymbols: new Set([...resolution.seenSymbols, symbol]) },
    declaration.initializer,
  );
};

const objectElementSequences = (
  resolution: DuplicateResolution,
  element: ts.ObjectLiteralElementLike,
): PropertySequences | null => {
  if (ts.isSpreadAssignment(element)) {
    const spreadSequences = objectExpressionSequences(resolution, element.expression);
    if (spreadSequences === null) return null;
    if (spreadSequences.some(hasInvalidObjectDuplicate)) {
      throw new Error(`${resolution.declaration.name.getText()}: canonical values must be unique`);
    }
    return spreadSequences.map(collapsedSpreadProperties);
  }
  const property = directObjectProperty(resolution.checker, element);
  if (property !== undefined) return [[property]];
  throw new Error(`${resolution.declaration.name.getText()}: canonical object keys must be static`);
};

const objectLiteralSequences = (
  resolution: DuplicateResolution,
  initializer: ts.ObjectLiteralExpression,
): PropertySequences | null =>
  initializer.properties.reduce<PropertySequences | null>(
    (sequences, element) => {
      if (sequences === null) return null;
      const elementSequences = objectElementSequences(resolution, element);
      return elementSequences === null
        ? null
        : appendPropertySequences(sequences, elementSequences);
    },
    [[]],
  );

const resultExpressions = (expression: ts.Expression): readonly ts.Expression[] => {
  const unwrapped = unwrapInitializer(expression);
  if (ts.isConditionalExpression(unwrapped)) {
    return [...resultExpressions(unwrapped.whenTrue), ...resultExpressions(unwrapped.whenFalse)];
  }
  if (
    ts.isBinaryExpression(unwrapped) &&
    unwrapped.operatorToken.kind === ts.SyntaxKind.CommaToken
  ) {
    return resultExpressions(unwrapped.right);
  }
  if (ts.isCommaListExpression(unwrapped)) {
    const finalExpression = unwrapped.elements[unwrapped.elements.length - 1];
    return finalExpression === undefined ? [] : resultExpressions(finalExpression);
  }
  return [unwrapped];
};

const validateUniqueArrayExpression = (
  resolution: DuplicateResolution,
  initializer: ts.Expression,
): void => {
  const sequences = arrayExpressionSequences(resolution.checker, initializer);
  if (sequences === null) {
    throw new Error(
      `${resolution.declaration.name.getText()}: canonical array values must be static`,
    );
  }
  if (
    sequences.every((sequence) => uniqBy(sequence, canonicalValueKey).length === sequence.length)
  ) {
    return;
  }
  throw new Error(`${resolution.declaration.name.getText()}: canonical values must be unique`);
};

const validateUniqueObjectExpression = (
  resolution: DuplicateResolution,
  initializer: ts.Expression,
): void => {
  const sequences = objectExpressionSequences(resolution, initializer);
  if (sequences === null) {
    throw new Error(
      `${resolution.declaration.name.getText()}: canonical object keys must be static`,
    );
  }
  if (sequences.every((sequence) => !hasInvalidObjectDuplicate(sequence))) return;
  throw new Error(`${resolution.declaration.name.getText()}: canonical values must be unique`);
};

const validateUniqueResultExpression = (
  resolution: DuplicateResolution,
  initializer: ts.Expression,
): void => {
  const type = resolution.checker.getTypeAtLocation(initializer);
  if (resolution.checker.isArrayType(type) || resolution.checker.isTupleType(type)) {
    validateUniqueArrayExpression(resolution, initializer);
    return;
  }
  if ((type.flags & ts.TypeFlags.Object) !== 0) {
    validateUniqueObjectExpression(resolution, initializer);
  }
};

export const validateDirectCanonicalValueDuplicates = (
  checker: ts.TypeChecker,
  declaration: ts.VariableDeclaration,
): void => {
  if (declaration.initializer === undefined) return;
  const resolution = { checker, declaration, seenSymbols: new Set<ts.Symbol>() };
  for (const initializer of resultExpressions(declaration.initializer)) {
    validateUniqueResultExpression(resolution, initializer);
  }
};
