import { assembledShapeOf, WRITTEN_OUT_SHAPE } from "../spec-syntax/assembled-values.ts";
import { handedValues, partsOf } from "../spec-syntax/expression-parts.ts";
import { unwrapSubject } from "../spec-syntax/subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

const WRITABLE_ONCE_HELD: ReadonlySet<string> = new Set([
  "ArrayExpression",
  "NewExpression",
  "ObjectExpression",
]);

export type SpecNameReach = {
  readonly boundValueOf: (written: ESTree.IdentifierReference) => ESTree.Expression | null;
  readonly isDeclaredHere: (written: ESTree.IdentifierReference) => boolean;
};

const isClosedConstruction = (input: {
  readonly written: ESTree.NewExpression;
  readonly reach: SpecNameReach;
  readonly isClosed: (written: ESTree.Expression) => boolean;
}): boolean => {
  const { written, reach, isClosed } = input;
  const built = unwrapSubject(written.callee);
  if (built.type !== "Identifier" || reach.isDeclaredHere(built)) return false;
  return handedValues(written.arguments).every((handed) => isClosed(handed));
};

const pickedKeyOf = (written: ESTree.MemberExpression): readonly ESTree.Expression[] =>
  written.computed ? [written.property] : [];

const COMPOSED_FROM_PARTS: ReadonlySet<string> = new Set([
  "ArrayExpression",
  "BinaryExpression",
  "ConditionalExpression",
  "LogicalExpression",
  "MemberExpression",
  "ObjectExpression",
  "SequenceExpression",
  "TemplateLiteral",
  "UnaryExpression",
]);

const composedPartsOf = (written: ESTree.Expression): readonly ESTree.Expression[] | null => {
  if (!COMPOSED_FROM_PARTS.has(written.type)) return null;
  return written.type === "MemberExpression"
    ? [...partsOf(written), ...pickedKeyOf(written)]
    : partsOf(written);
};

const isClosedShape = (input: {
  readonly bare: ESTree.Expression;
  readonly reach: SpecNameReach;
  readonly closedAs: (written: ESTree.Expression, onceHeld: boolean) => boolean;
}): boolean => {
  const { bare, reach, closedAs } = input;
  if (bare.type === "Identifier") {
    const bound = reach.boundValueOf(bare);
    return bound !== null && closedAs(bound, true);
  }
  if (bare.type === "NewExpression") {
    return isClosedConstruction({
      written: bare,
      reach,
      isClosed: (written) => closedAs(written, false),
    });
  }
  return composedPartsOf(bare)?.every((part) => closedAs(part, false)) ?? false;
};

export const isSpecClosedValue = (input: {
  readonly written: ESTree.Expression;
  readonly reach: SpecNameReach;
  readonly walked?: ReadonlySet<ESTree.Expression>;
  readonly held?: boolean;
}): boolean => {
  const { written, reach, walked = new Set<ESTree.Expression>(), held = false } = input;
  const bare = unwrapSubject(written);
  if (walked.has(bare) || (held && WRITABLE_ONCE_HELD.has(bare.type))) return false;
  if (assembledShapeOf(bare) === WRITTEN_OUT_SHAPE) return true;

  const reached = new Set([...walked, bare]);
  return isClosedShape({
    bare,
    reach,
    closedAs: (reachedNext, onceHeld) =>
      isSpecClosedValue({ written: reachedNext, reach, walked: reached, held: held || onceHeld }),
  });
};
