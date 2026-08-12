import * as ts from "typescript-6";

import {
  canonicalOwnerDefaultLibraryExpression,
  canonicalOwnerDefaultLibraryExpressionIsStable,
} from "./canonical-owner-standard-stability.ts";
import {
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";

export const canonicalOwnerExpressionIsDefaultLibrary = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => canonicalOwnerDefaultLibraryExpression({ ...state, expression });

export const canonicalOwnerExpressionIsStableDefaultLibrary = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => canonicalOwnerDefaultLibraryExpressionIsStable({ ...state, expression });

export const canonicalOwnerGlobalIdentifierIs = (input: {
  readonly identifier: ts.Expression;
  readonly name: string;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const current = unwrapCanonicalOwnerExpression(input.identifier);
  return (
    ts.isIdentifier(current) &&
    current.text === input.name &&
    canonicalOwnerExpressionIsDefaultLibrary(input.state, current)
  );
};
