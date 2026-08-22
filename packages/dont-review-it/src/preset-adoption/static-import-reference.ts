import { isReferenceTo, type ImportedTarget } from "../lint/oxlint/lib/imported-binding.ts";
import { unwrapTransparentExpression } from "../lint/oxlint/lib/transparent-expression.ts";

import type { ESTree } from "@oxlint/plugins";

const isCallableExpression = (
  callee: ESTree.CallExpression["callee"],
): callee is ESTree.Expression =>
  callee.type !== "Super" && callee.type !== "V8IntrinsicExpression";

const objectPassedDirectlyTo = ({
  expression,
  target,
}: {
  readonly expression: ESTree.Expression;
  readonly target: ImportedTarget;
}): ESTree.ObjectExpression | null => {
  const unwrapped = unwrapTransparentExpression(expression);
  if (unwrapped.type !== "CallExpression" || !isCallableExpression(unwrapped.callee)) return null;
  if (!isReferenceTo(unwrapTransparentExpression(unwrapped.callee), target)) return null;
  const [argument, extra] = unwrapped.arguments;
  if (argument === undefined) return null;
  if (extra !== undefined) return null;
  if (argument.type === "SpreadElement") return null;
  const handed = unwrapTransparentExpression(argument);
  return handed.type === "ObjectExpression" ? handed : null;
};

const isReferenceToMember = ({
  expression,
  target,
  memberName,
}: {
  readonly expression: ESTree.Expression;
  readonly target: ImportedTarget;
  readonly memberName: string;
}): boolean => {
  const member = unwrapTransparentExpression(expression);
  if (member.type !== "MemberExpression" || member.computed) return false;
  if (member.object.type === "Super") return false;
  if (member.property.type !== "Identifier") return false;
  if (member.property.name !== memberName) return false;
  return isReferenceTo(unwrapTransparentExpression(member.object), target);
};

export const objectPassedDirectlyToMember = ({
  expression,
  target,
  memberName,
}: {
  readonly expression: ESTree.Expression;
  readonly target: ImportedTarget;
  readonly memberName: string;
}): ESTree.ObjectExpression | null => {
  const unwrapped = unwrapTransparentExpression(expression);
  if (unwrapped.type !== "CallExpression" || !isCallableExpression(unwrapped.callee)) return null;
  if (!isReferenceToMember({ expression: unwrapped.callee, target, memberName })) return null;
  const [argument, extra] = unwrapped.arguments;
  if (argument === undefined || extra !== undefined || argument.type === "SpreadElement")
    return null;
  const handed = unwrapTransparentExpression(argument);
  return handed.type === "ObjectExpression" ? handed : null;
};

const defaultExportedExpression = (program: ESTree.Program): ESTree.Expression | null => {
  const exported = program.body.findLast(
    (statement): statement is ESTree.ExportDefaultDeclaration =>
      statement.type === "ExportDefaultDeclaration",
  );
  if (exported === undefined) return null;
  const { declaration } = exported;
  if (
    declaration.type === "FunctionDeclaration" ||
    declaration.type === "ClassDeclaration" ||
    declaration.type === "TSInterfaceDeclaration"
  ) {
    return null;
  }
  return declaration;
};

export const staticDefaultExportedConfig = ({
  program,
  factory,
}: {
  readonly program: ESTree.Program;
  readonly factory: ImportedTarget;
}): ESTree.ObjectExpression | null => {
  const declaration = defaultExportedExpression(program);
  if (declaration === null) return null;
  const unwrapped = unwrapTransparentExpression(declaration);
  return unwrapped.type === "ObjectExpression"
    ? unwrapped
    : objectPassedDirectlyTo({ expression: unwrapped, target: factory });
};
