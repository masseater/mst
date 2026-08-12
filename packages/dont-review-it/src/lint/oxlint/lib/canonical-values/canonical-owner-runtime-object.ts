import * as ts from "typescript-6";

import {
  runtimeExpressionSources,
  runtimePrimitive,
  unwrapRuntimeExpression,
  type RuntimeSequenceResolution,
} from "./canonical-owner-runtime-expression.ts";

type ObjectSequences = readonly (readonly string[])[];

const objectPropertyNames = (
  resolution: RuntimeSequenceResolution,
  name: ts.PropertyName,
): readonly string[] | null => {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return [name.text];
  }
  if (!ts.isComputedPropertyName(name)) return null;
  const sources = runtimeExpressionSources(resolution, name.expression);
  if (sources === null) return null;
  const primitives = sources.map((source) => runtimePrimitive(source.expression));
  return primitives.some((primitive) => primitive === undefined)
    ? null
    : primitives.map((primitive) => String(primitive));
};

const mergeObjectKeys = (
  existing: readonly string[],
  added: readonly string[],
): readonly string[] => [...existing.filter((key) => !added.includes(key)), ...added];

const mergeObjectSequences = (
  prefixes: ObjectSequences,
  suffixes: ObjectSequences,
): ObjectSequences =>
  prefixes.flatMap((prefix) => suffixes.map((suffix) => mergeObjectKeys(prefix, suffix)));

const objectPropertyIsPrototypeSetter = (
  property: ts.ObjectLiteralElementLike,
): property is ts.PropertyAssignment =>
  ts.isPropertyAssignment(property) &&
  !ts.isComputedPropertyName(property.name) &&
  ((ts.isIdentifier(property.name) && property.name.text === "__proto__") ||
    (ts.isStringLiteralLike(property.name) && property.name.text === "__proto__"));

const appendObjectProperty = (input: {
  readonly property: ts.ObjectLiteralElementLike;
  readonly resolution: RuntimeSequenceResolution;
  readonly sequences: ObjectSequences;
}): ObjectSequences | null => {
  if (ts.isSpreadAssignment(input.property)) {
    const spread = runtimeObjectSequences(input.resolution, input.property.expression);
    return spread === null ? null : mergeObjectSequences(input.sequences, spread);
  }
  if (objectPropertyIsPrototypeSetter(input.property)) return input.sequences;
  const names = objectPropertyNames(input.resolution, input.property.name);
  return names === null
    ? null
    : names.flatMap((name) => input.sequences.map((sequence) => mergeObjectKeys(sequence, [name])));
};

const objectSequencesFromSource = (
  resolution: RuntimeSequenceResolution,
  expression: ts.Expression,
): ObjectSequences | null => {
  const current = unwrapRuntimeExpression(expression);
  return ts.isObjectLiteralExpression(current)
    ? current.properties.reduce<ObjectSequences | null>(
        (sequences, property) =>
          sequences === null ? null : appendObjectProperty({ property, resolution, sequences }),
        [[]],
      )
    : null;
};

export const runtimeObjectSequences = (
  resolution: RuntimeSequenceResolution,
  expression: ts.Expression,
): ObjectSequences | null => {
  const sources = runtimeExpressionSources(resolution, expression);
  if (sources === null) return null;
  const sequences = sources.map((source) =>
    objectSequencesFromSource(source.resolution, source.expression),
  );
  return sequences.some((sequence) => sequence === null)
    ? null
    : sequences.flatMap((sequence) => sequence as ObjectSequences);
};
