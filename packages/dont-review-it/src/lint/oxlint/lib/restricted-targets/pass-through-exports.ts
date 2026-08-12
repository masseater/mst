import { astFieldsOf, nodeTypeOf } from "../setup-modules/coupling-edges.ts";

import type { AstFields } from "../ast-node.ts";

export type PassThroughExport<Statement> = {
  readonly statement: Statement;
  readonly specifier: string;
  readonly exported: string | null;
  readonly exposed: string;
};

type ForwardedName = {
  readonly specifier: string;
  readonly exported: string | null;
  readonly exposed: string;
};

type ImportedBinding = {
  readonly specifier: string;
  readonly exported: string | null;
};

const WHOLE_SURFACE = "*";

const DEFAULT_EXPORT_NAME = "default";

const fieldListOf = (held: unknown): readonly AstFields[] =>
  Array.isArray(held) ? held.map(astFieldsOf).filter((candidate) => candidate !== null) : [];

const specifierTextOf = (held: unknown): string | null => {
  const source = astFieldsOf(held);
  return typeof source?.value === "string" ? source.value : null;
};

const nameOf = (held: unknown): string | null => {
  const named = astFieldsOf(held);
  if (named === null) return null;
  if (nodeTypeOf(named) === "Identifier") return typeof named.name === "string" ? named.name : null;
  return typeof named.value === "string" ? named.value : null;
};

const importedBindingOf = (
  imported: AstFields,
  specifier: string,
): readonly (readonly [string, ImportedBinding])[] => {
  const local = nameOf(imported.local);
  if (local === null) return [];

  const nodeType = nodeTypeOf(imported);
  if (nodeType === "ImportNamespaceSpecifier")
    return [[local, { specifier, exported: null }] as const];
  if (nodeType === "ImportDefaultSpecifier") {
    return [[local, { specifier, exported: DEFAULT_EXPORT_NAME }] as const];
  }
  return [[local, { specifier, exported: nameOf(imported.imported) }] as const];
};

const requiredBindingOf = (
  statement: AstFields,
): readonly (readonly [string, ImportedBinding])[] => {
  const reference = astFieldsOf(statement.moduleReference);
  if (reference === null || nodeTypeOf(reference) !== "TSExternalModuleReference") return [];

  const specifier = specifierTextOf(reference.expression);
  const local = nameOf(statement.id);
  if (specifier === null || local === null) return [];
  return [[local, { specifier, exported: null }] as const];
};

const importedBindingsIn = (
  statement: AstFields,
): readonly (readonly [string, ImportedBinding])[] => {
  const nodeType = nodeTypeOf(statement);
  if (nodeType === "TSImportEqualsDeclaration") return requiredBindingOf(statement);
  if (nodeType !== "ImportDeclaration") return [];

  const specifier = specifierTextOf(statement.source);
  if (specifier === null) return [];
  return fieldListOf(statement.specifiers).flatMap((imported) =>
    importedBindingOf(imported, specifier),
  );
};

const forwardedFromSource = (statement: AstFields): readonly ForwardedName[] => {
  const specifier = specifierTextOf(statement.source);
  if (specifier === null) return [];

  if (nodeTypeOf(statement) === "ExportAllDeclaration") {
    return [{ specifier, exported: null, exposed: nameOf(statement.exported) ?? WHOLE_SURFACE }];
  }
  return fieldListOf(statement.specifiers).flatMap((exported) => {
    const exposed = nameOf(exported.exported);
    return exposed === null ? [] : [{ specifier, exported: nameOf(exported.local), exposed }];
  });
};

const forwardedFromBindings = (
  statement: AstFields,
  bindings: ReadonlyMap<string, ImportedBinding>,
): readonly ForwardedName[] =>
  fieldListOf(statement.specifiers).flatMap((exported) => {
    const local = nameOf(exported.local);
    const exposed = nameOf(exported.exported);
    const bound = local === null ? undefined : bindings.get(local);
    return bound === undefined || exposed === null ? [] : [{ ...bound, exposed }];
  });

const forwardedDefault = (
  statement: AstFields,
  bindings: ReadonlyMap<string, ImportedBinding>,
): readonly ForwardedName[] => {
  const declared = astFieldsOf(statement.declaration);
  if (declared === null || nodeTypeOf(declared) !== "Identifier") return [];

  const local = nameOf(declared);
  const bound = local === null ? undefined : bindings.get(local);
  return bound === undefined ? [] : [{ ...bound, exposed: DEFAULT_EXPORT_NAME }];
};

const forwardedIn = (
  statement: AstFields,
  bindings: ReadonlyMap<string, ImportedBinding>,
): readonly ForwardedName[] => {
  const nodeType = nodeTypeOf(statement);
  if (nodeType === "ExportAllDeclaration") return forwardedFromSource(statement);
  if (nodeType === "ExportDefaultDeclaration") return forwardedDefault(statement, bindings);
  if (nodeType !== "ExportNamedDeclaration") return [];

  const source = astFieldsOf(statement.source);
  return source === null
    ? forwardedFromBindings(statement, bindings)
    : forwardedFromSource(statement);
};

export const passThroughExportsIn = <Statement>(
  writtenBody: readonly Statement[],
): readonly PassThroughExport<Statement>[] => {
  const statements = writtenBody.map((statement) => ({
    statement,
    fields: astFieldsOf(statement),
  }));
  const bindings = new Map(
    statements.flatMap(({ fields }) => (fields === null ? [] : importedBindingsIn(fields))),
  );

  return statements.flatMap(({ statement, fields }) =>
    fields === null
      ? []
      : forwardedIn(fields, bindings).map((forwarded) => ({ statement, ...forwarded })),
  );
};
