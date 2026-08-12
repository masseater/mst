import {
  annotatedDeclarationRanges,
  type AnnotatedDeclarationRange,
} from "./annotated-declaration.ts";
import { unwrapExpression } from "./finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";

export type FileBindings = {
  readonly arrays: ReadonlyMap<string, ESTree.ArrayExpression>;
  readonly namedImports: ReadonlyMap<string, string>;
  readonly annotatedRanges: readonly AnnotatedDeclarationRange[];
};

const arraysDeclaredIn = (
  declaration: ESTree.VariableDeclaration,
): readonly (readonly [string, ESTree.ArrayExpression])[] =>
  declaration.declarations.flatMap((declarator) => {
    if (declarator.id.type !== "Identifier") return [];
    if (declarator.init === null) return [];
    const init = unwrapExpression(declarator.init);
    return init.type === "ArrayExpression" ? [[declarator.id.name, init] as const] : [];
  });

const arraysBoundBy = (
  statement: ESTree.Program["body"][number],
): readonly (readonly [string, ESTree.ArrayExpression])[] => {
  if (statement.type === "VariableDeclaration") return arraysDeclaredIn(statement);
  if (
    statement.type === "ExportNamedDeclaration" &&
    statement.declaration?.type === "VariableDeclaration"
  ) {
    return arraysDeclaredIn(statement.declaration);
  }
  return [];
};

const namedImportsBoundBy = (
  statement: ESTree.Program["body"][number],
): readonly (readonly [string, string])[] => {
  if (statement.type !== "ImportDeclaration") return [];

  return statement.specifiers.flatMap((specifier) =>
    specifier.type === "ImportSpecifier"
      ? [[specifier.local.name, statement.source.value] as const]
      : [],
  );
};

export const collectFileBindings = (program: ESTree.Program, sourceText: string): FileBindings => ({
  arrays: new Map(program.body.flatMap(arraysBoundBy)),
  namedImports: new Map(program.body.flatMap(namedImportsBoundBy)),
  annotatedRanges: annotatedDeclarationRanges(program, sourceText),
});

export const firstNonSpreadArgument = (
  node: ESTree.CallExpression | ESTree.NewExpression,
): ESTree.Expression | null => {
  const [argument] = node.arguments;
  if (argument === undefined || argument.type === "SpreadElement") return null;
  return argument;
};
