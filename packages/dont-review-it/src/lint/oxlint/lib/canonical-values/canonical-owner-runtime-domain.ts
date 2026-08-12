import * as ts from "typescript-6";

import { runtimeArraySequences } from "./canonical-owner-runtime-array.ts";
import { runtimeObjectSequences } from "./canonical-owner-runtime-object.ts";
import { canonicalValueKey, fingerprintValues, type CanonicalValue } from "./fingerprint.ts";

import type { RuntimeSequenceResolution } from "./canonical-owner-runtime-expression.ts";

const sequenceMatches = (
  expectedFingerprint: string,
  sequence: readonly CanonicalValue[],
): boolean =>
  sequence.length > 0 &&
  new Set(sequence.map(canonicalValueKey)).size === sequence.length &&
  fingerprintValues(sequence) === expectedFingerprint;

const runtimeSequences = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
  readonly initializer: ts.Expression;
  readonly nodes: readonly ts.Node[];
  readonly program: ts.Program;
}): readonly (readonly CanonicalValue[])[] | null => {
  const resolution: RuntimeSequenceResolution = {
    checker: input.checker,
    nodes: input.nodes,
    program: input.program,
    seenFunctions: new Set(),
    seenSymbols: new Set(),
  };
  const bindingType = input.checker.getTypeAtLocation(input.declaration.name);
  return input.checker.getIndexTypeOfType(bindingType, ts.IndexKind.Number) === undefined
    ? runtimeObjectSequences(resolution, input.initializer)
    : runtimeArraySequences(resolution, input.initializer);
};

export const validateCanonicalOwnerRuntimeDomain = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
  readonly expectedValues: readonly CanonicalValue[];
  readonly nodes: readonly ts.Node[];
  readonly program: ts.Program;
}): void => {
  const initializer = input.declaration.initializer;
  if (initializer === undefined) {
    throw new Error(`${input.declaration.name.getText()}: canonical owner must have a value`);
  }
  const sequences = runtimeSequences({ ...input, initializer });
  const expectedFingerprint = fingerprintValues(input.expectedValues);
  if (
    sequences === null ||
    sequences.length === 0 ||
    !sequences.every((sequence) => sequenceMatches(expectedFingerprint, sequence))
  ) {
    throw new Error(
      `${input.declaration.name.getText()}: canonical owner runtime values must match its domain`,
    );
  }
};
