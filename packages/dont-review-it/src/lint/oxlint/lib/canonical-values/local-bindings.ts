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

const collectArrays = (
  declaration: ESTree.VariableDeclaration,
  arrays: Map<string, ESTree.ArrayExpression>,
): void => {
  for (const declarator of declaration.declarations) {
    if (declarator.id.type !== "Identifier") continue;
    if (declarator.init === null) continue;
    const init = unwrapExpression(declarator.init);
    if (init.type === "ArrayExpression") arrays.set(declarator.id.name, init);
  }
};

const collectNamedImports = (
  statement: ESTree.ImportDeclaration,
  namedImports: Map<string, string>,
): void => {
  for (const specifier of statement.specifiers) {
    if (specifier.type !== "ImportSpecifier") continue;
    namedImports.set(specifier.local.name, statement.source.value);
  }
};

export const collectFileBindings = (program: ESTree.Program, sourceText: string): FileBindings => {
  const arrays = new Map<string, ESTree.ArrayExpression>();
  const namedImports = new Map<string, string>();

  for (const statement of program.body) {
    if (statement.type === "ImportDeclaration") collectNamedImports(statement, namedImports);
    else if (statement.type === "VariableDeclaration") collectArrays(statement, arrays);
    else if (
      statement.type === "ExportNamedDeclaration" &&
      statement.declaration?.type === "VariableDeclaration"
    ) {
      collectArrays(statement.declaration, arrays);
    }
  }

  return { arrays, namedImports, annotatedRanges: annotatedDeclarationRanges(program, sourceText) };
};

export const firstNonSpreadArgument = (
  node: ESTree.CallExpression | ESTree.NewExpression,
): ESTree.Expression | null => {
  const [argument] = node.arguments;
  if (argument === undefined || argument.type === "SpreadElement") return null;
  return argument;
};
