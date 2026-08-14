import { dirname, join } from "node:path";

import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";
import { toPosixPath } from "../posix-path.ts";

export type ImportRoutes = ReadonlyMap<string, string>;

const RELATIVE_SPECIFIER = /^\.{1,2}\//u;

const SCRIPT_EXTENSION = /\.[cm]?[jt]sx?$/u;

const importedModuleOf = (input: {
  readonly specifier: string;
  readonly fromRelativePath: string;
}): string => {
  const { specifier, fromRelativePath } = input;
  if (!RELATIVE_SPECIFIER.test(specifier)) return specifier;
  return toPosixPath(join(dirname(fromRelativePath), specifier)).replace(SCRIPT_EXTENSION, "");
};

const DEFAULT_IMPORT = "default";

const WHOLE_MODULE_IMPORT = "*";

const takenNameOf = (specifier: AstFields): string => {
  const nodeKind = specifier[NODE_TYPE_FIELD];
  if (nodeKind === "ImportDefaultSpecifier") return DEFAULT_IMPORT;
  if (nodeKind === "ImportNamespaceSpecifier") return WHOLE_MODULE_IMPORT;

  const taken = specifier.imported as AstFields;
  return String(taken.name ?? taken.value);
};

const routesThrough = (input: {
  readonly declaration: AstFields;
  readonly module: string;
}): readonly (readonly [string, string])[] =>
  (input.declaration.specifiers as readonly unknown[])
    .filter(isAstFields)
    .map((specifier) => [
      String((specifier.local as AstFields).name),
      `${input.module}#${takenNameOf(specifier)}`,
    ]);

export const importRoutesIn = (input: {
  readonly body: readonly unknown[];
  readonly relativePath: string;
}): ImportRoutes =>
  new Map(
    input.body.filter(isAstFields).flatMap((statement) =>
      statement[NODE_TYPE_FIELD] === "ImportDeclaration"
        ? routesThrough({
            declaration: statement,
            module: importedModuleOf({
              specifier: String((statement.source as AstFields).value),
              fromRelativePath: input.relativePath,
            }),
          })
        : [],
    ),
  );
