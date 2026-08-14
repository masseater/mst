import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { readUnlessMissing } from "@mst/repository-checks";
import { parseSync } from "oxc-parser";

import type { ESTree } from "@oxlint/plugins";
import type { SpecStatement } from "./subject-expressions.ts";

const REPOSITORY_SPECIFIER = /^\.{1,2}\//u;

export type ImportedName = {
  readonly specifier: string;
  readonly exported: string;
};

export type ModuleDeclarations = {
  readonly filename: string;
  readonly initializerByName: ReadonlyMap<string, ESTree.Expression>;
  readonly importedByName: ReadonlyMap<string, ImportedName>;
  readonly localNameByExported: ReadonlyMap<string, string>;
  readonly forwardedByExported: ReadonlyMap<string, ImportedName>;
  readonly forwardedSpecifiers: readonly string[];
};

export type ImportedDeclaration = {
  readonly module: ModuleDeclarations;
  readonly declared: ESTree.Expression;
};

const declaredStatement = (statement: SpecStatement): SpecStatement =>
  statement.type === "ExportNamedDeclaration" && statement.declaration !== null
    ? statement.declaration
    : statement;

const boundName = (
  named: { readonly name: string } | null,
  bound: ESTree.Expression | null,
): readonly (readonly [string, ESTree.Expression])[] =>
  named === null || bound === null ? [] : [[named.name, bound] as const];

const boundNamesIn = (
  statement: SpecStatement,
): readonly (readonly [string, ESTree.Expression])[] => {
  const declared = declaredStatement(statement);
  if (declared.type === "FunctionDeclaration") return boundName(declared.id, declared);
  if (declared.type !== "VariableDeclaration" || declared.kind !== "const") return [];

  return declared.declarations.flatMap((declarator) =>
    boundName(declarator.id.type === "Identifier" ? declarator.id : null, declarator.init),
  );
};

export const moduleExportSpelling = (spelled: ESTree.ModuleExportName): string =>
  spelled.type === "Identifier" ? spelled.name : spelled.value;

const importedNamesIn = (
  statement: SpecStatement,
): readonly (readonly [string, ImportedName])[] => {
  if (statement.type !== "ImportDeclaration") return [];

  const specifier = statement.source.value;
  return statement.specifiers.flatMap((imported) =>
    imported.type === "ImportSpecifier"
      ? [
          [
            imported.local.name,
            { specifier, exported: moduleExportSpelling(imported.imported) },
          ] as const,
        ]
      : [],
  );
};

const exportedAliasesIn = (statement: SpecStatement): readonly (readonly [string, string])[] =>
  statement.type === "ExportNamedDeclaration" && statement.source === null
    ? statement.specifiers.map(
        (exported) =>
          [moduleExportSpelling(exported.exported), moduleExportSpelling(exported.local)] as const,
      )
    : [];

const forwardedNamesIn = (
  statement: SpecStatement,
): readonly (readonly [string, ImportedName])[] => {
  if (statement.type !== "ExportNamedDeclaration" || statement.source === null) return [];

  const specifier = statement.source.value;
  return statement.specifiers.map(
    (exported) =>
      [
        moduleExportSpelling(exported.exported),
        { specifier, exported: moduleExportSpelling(exported.local) },
      ] as const,
  );
};

const forwardedSpecifiersIn = (statement: SpecStatement): readonly string[] =>
  statement.type === "ExportAllDeclaration" && statement.exported === null
    ? [statement.source.value]
    : [];

export const moduleDeclarationsOf = (
  filename: string,
  writtenBody: readonly SpecStatement[],
): ModuleDeclarations => ({
  filename,
  initializerByName: new Map(writtenBody.flatMap(boundNamesIn)),
  importedByName: new Map(writtenBody.flatMap(importedNamesIn)),
  localNameByExported: new Map(writtenBody.flatMap(exportedAliasesIn)),
  forwardedByExported: new Map(writtenBody.flatMap(forwardedNamesIn)),
  forwardedSpecifiers: writtenBody.flatMap(forwardedSpecifiersIn),
});

const parsedModuleAt = (path: string): ModuleDeclarations | null => {
  const source = readUnlessMissing(() => readFileSync(path, "utf8"));
  if (source === null) return null;

  const writtenBody = parseSync(path, source).program.body.map(
    (statement) => statement as SpecStatement,
  );
  return moduleDeclarationsOf(path, writtenBody);
};

const declaredUnderName = (reading: {
  readonly module: ModuleDeclarations;
  readonly exported: string;
  readonly visited: ReadonlySet<string>;
}): ImportedDeclaration | null => {
  const { module, exported, visited } = reading;
  const local = module.localNameByExported.get(exported) ?? exported;

  const bound = module.initializerByName.get(local);
  if (bound !== undefined) return { module, declared: bound };

  const imported = module.importedByName.get(local);
  if (imported !== undefined) return importedDeclarationOf({ from: module, imported, visited });

  const forwarded = module.forwardedByExported.get(exported);
  if (forwarded !== undefined) {
    return importedDeclarationOf({ from: module, imported: forwarded, visited });
  }

  return (
    module.forwardedSpecifiers
      .map((specifier) =>
        importedDeclarationOf({ from: module, imported: { specifier, exported }, visited }),
      )
      .find((found) => found !== null) ?? null
  );
};

export const importedDeclarationOf = (asked: {
  readonly from: ModuleDeclarations;
  readonly imported: ImportedName;
  readonly visited: ReadonlySet<string>;
}): ImportedDeclaration | null => {
  const { from, imported, visited } = asked;
  if (!REPOSITORY_SPECIFIER.test(imported.specifier)) return null;

  const path = resolve(dirname(from.filename), imported.specifier);
  if (visited.has(path)) return null;

  const module = parsedModuleAt(path);
  if (module === null) return null;
  return declaredUnderName({
    module,
    exported: imported.exported,
    visited: new Set([...visited, path]),
  });
};
