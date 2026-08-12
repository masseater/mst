import * as ts from "typescript-6";

import {
  runtimeExpressionSources,
  runtimePrimitive,
  unwrapRuntimeExpression,
  type RuntimeSequenceResolution,
} from "./canonical-owner-runtime-expression.ts";

import type { CanonicalValue } from "./fingerprint.ts";

export type RuntimeSequences = readonly (readonly CanonicalValue[])[];

const primitiveAlternatives = (
  resolution: RuntimeSequenceResolution,
  expression: ts.Expression,
): readonly CanonicalValue[] | null => {
  const sources = runtimeExpressionSources(resolution, expression);
  if (sources === null) return null;
  const primitives = sources.map((source) => runtimePrimitive(source.expression));
  return primitives.some((primitive) => primitive === undefined)
    ? null
    : (primitives as readonly CanonicalValue[]);
};

const appendSequences = (
  prefixes: RuntimeSequences,
  suffixes: RuntimeSequences,
): RuntimeSequences =>
  prefixes.flatMap((prefix) => suffixes.map((suffix) => [...prefix, ...suffix]));

const appendArrayElement = (input: {
  readonly element: ts.Expression;
  readonly resolution: RuntimeSequenceResolution;
  readonly sequences: RuntimeSequences;
}): RuntimeSequences | null => {
  if (ts.isOmittedExpression(input.element)) return null;
  if (ts.isSpreadElement(input.element)) {
    const spread = runtimeArraySequences(input.resolution, input.element.expression);
    return spread === null ? null : appendSequences(input.sequences, spread);
  }
  const alternatives = primitiveAlternatives(input.resolution, input.element);
  return alternatives === null
    ? null
    : appendSequences(
        input.sequences,
        alternatives.map((alternative) => [alternative]),
      );
};

const arraySequencesFromSource = (
  resolution: RuntimeSequenceResolution,
  expression: ts.Expression,
): RuntimeSequences | null => {
  const current = unwrapRuntimeExpression(expression);
  return ts.isArrayLiteralExpression(current)
    ? current.elements.reduce<RuntimeSequences | null>(
        (sequences, element) =>
          sequences === null ? null : appendArrayElement({ element, resolution, sequences }),
        [[]],
      )
    : null;
};

export const runtimeArraySequences = (
  resolution: RuntimeSequenceResolution,
  expression: ts.Expression,
): RuntimeSequences | null => {
  const sources = runtimeExpressionSources(resolution, expression);
  if (sources === null) return null;
  const sequences = sources.map((source) =>
    arraySequencesFromSource(source.resolution, source.expression),
  );
  return sequences.some((sequence) => sequence === null)
    ? null
    : sequences.flatMap((sequence) => sequence as RuntimeSequences);
};
