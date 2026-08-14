import { isReferenceOf, type ImportedTarget } from "../lint/oxlint/lib/imported-binding.ts";
import { unwrapTransparentExpression } from "../lint/oxlint/lib/transparent-expression.ts";

import type { ESTree } from "@oxlint/plugins";

export type ValueImportBindings = {
  readonly directNames: ReadonlySet<string>;
  readonly namespaceNames: ReadonlySet<string>;
};

const isCallableExpression = (
  callee: ESTree.CallExpression["callee"],
): callee is ESTree.Expression =>
  callee.type !== "Super" && callee.type !== "V8IntrinsicExpression";

export const objectPassedDirectlyTo = ({
  expression,
  target,
}: {
  readonly expression: ESTree.Expression;
  readonly target: ImportedTarget;
}): ESTree.ObjectExpression | null => {
  const unwrapped = unwrapTransparentExpression(expression);
  if (unwrapped.type !== "CallExpression" || !isCallableExpression(unwrapped.callee)) return null;
  if (!isReferenceOf(unwrapTransparentExpression(unwrapped.callee), target)) return null;
  const [argument, extra] = unwrapped.arguments;
  if (argument === undefined) return null;
  if (extra !== undefined) return null;
  if (argument.type === "SpreadElement") return null;
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

const valueImportDeclarations = (program: ESTree.Program): readonly ESTree.ImportDeclaration[] =>
  program.body.filter(
    (statement): statement is ESTree.ImportDeclaration =>
      statement.type === "ImportDeclaration" && statement.importKind !== "type",
  );

const directValueNamesIn = (declaration: ESTree.ImportDeclaration): readonly string[] =>
  declaration.specifiers.flatMap((specifier) => {
    if (specifier.type === "ImportNamespaceSpecifier") return [];
    if (specifier.type === "ImportSpecifier" && specifier.importKind === "type") return [];
    return [specifier.local.name];
  });

const namespaceValueNamesIn = (declaration: ESTree.ImportDeclaration): readonly string[] =>
  declaration.specifiers.flatMap((specifier) =>
    specifier.type === "ImportNamespaceSpecifier" ? [specifier.local.name] : [],
  );

export const allValueImportBindingsIn = (program: ESTree.Program): ValueImportBindings => ({
  directNames: new Set(valueImportDeclarations(program).flatMap(directValueNamesIn)),
  namespaceNames: new Set(valueImportDeclarations(program).flatMap(namespaceValueNamesIn)),
});

export const isStaticValueImportReference = (
  expression: ESTree.Expression,
  bindings: ValueImportBindings,
): boolean => {
  const unwrapped = unwrapTransparentExpression(expression);
  if (unwrapped.type === "Identifier") return bindings.directNames.has(unwrapped.name);
  return (
    unwrapped.type === "MemberExpression" &&
    !unwrapped.computed &&
    unwrapped.object.type === "Identifier" &&
    bindings.namespaceNames.has(unwrapped.object.name)
  );
};
