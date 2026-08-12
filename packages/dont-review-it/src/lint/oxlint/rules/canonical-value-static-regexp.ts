import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";

export const canonicalValueStaticRegexp = (expression: ESTree.Expression): RegExp | null => {
  const unwrapped = unwrapExpression(expression);
  if (unwrapped.type !== "Literal" || !("regex" in unwrapped)) return null;
  try {
    return new RegExp(unwrapped.regex.pattern, unwrapped.regex.flags);
  } catch (failure) {
    if (failure instanceof SyntaxError) return null;
    throw failure;
  }
};
