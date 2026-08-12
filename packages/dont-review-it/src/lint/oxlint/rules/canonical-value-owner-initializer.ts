import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";
import type { AnnotatedDeclarationRange } from "../lib/canonical-values/annotated-declaration.ts";

const variableDeclarationOf = (statement: ESTree.Statement): ESTree.VariableDeclaration | null => {
  if (statement.type === "VariableDeclaration") return statement;
  return statement.type === "ExportNamedDeclaration" &&
    statement.declaration?.type === "VariableDeclaration"
    ? statement.declaration
    : null;
};

const canonicalValueOwnerInitializer = ({
  program,
  range,
}: {
  readonly program: ESTree.Program;
  readonly range: AnnotatedDeclarationRange;
}): ESTree.Expression | null => {
  const statement = program.body.find(
    (candidate) => candidate.start === range.start && candidate.end === range.end,
  );
  if (statement === undefined) return null;
  const declaration = variableDeclarationOf(statement);
  const declarator = declaration?.declarations.find(
    (candidate) => candidate.id.type === "Identifier" && candidate.id.name === range.binding,
  );
  return declarator?.init === null || declarator?.init === undefined
    ? null
    : unwrapExpression(declarator.init);
};

const canonicalValueOwnerResultExpressions = (
  initializer: ESTree.Expression,
): readonly ESTree.Expression[] => {
  const expression = unwrapExpression(initializer);
  if (expression.type === "ConditionalExpression") {
    return [
      ...canonicalValueOwnerResultExpressions(expression.consequent),
      ...canonicalValueOwnerResultExpressions(expression.alternate),
    ];
  }
  if (expression.type !== "SequenceExpression") return [expression];
  const valueExpression = expression.expressions.at(-1);
  return valueExpression === undefined ? [] : canonicalValueOwnerResultExpressions(valueExpression);
};

export { canonicalValueOwnerInitializer, canonicalValueOwnerResultExpressions };
