import { canonicalOwnerSymbolAtExpression } from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

import type * as ts from "typescript-6";

const canonicalOwnerSymbolIsFromDefaultLibrary = (input: {
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
  readonly symbol: ts.Symbol;
}): boolean =>
  (resolveTypeScriptSymbol(input.checker, input.symbol).declarations ?? []).some((declaration) =>
    input.program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
  );

export const canonicalOwnerExpressionIsFromDefaultLibrary = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
}): boolean => {
  const symbol = canonicalOwnerSymbolAtExpression(input.checker, input.expression);
  return symbol !== null && canonicalOwnerSymbolIsFromDefaultLibrary({ ...input, symbol });
};
