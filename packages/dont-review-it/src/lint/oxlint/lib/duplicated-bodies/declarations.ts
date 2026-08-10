import { lineAtOffset, type AstNodeFields } from "@mst/utils";
import { isPlainObject } from "es-toolkit";
import { parseSync } from "oxc-parser";

import { NODE_TYPE_FIELD } from "../ast-node.ts";

export type BodyDeclaration = {
  readonly name: string;
  readonly line: number;
  readonly structure: string;
  readonly nodeCount: number;
};

const DEFAULT_SOURCE_NAME = "source.tsx";

const POSITION_FIELDS: ReadonlySet<string> = new Set(["start", "end", "range", "loc"]);

const namedFieldsOf = (node: AstNodeFields): readonly (readonly [string, unknown])[] =>
  Object.entries(node).filter(([field]) => !POSITION_FIELDS.has(field));

const structureOf = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(structureOf).join(",")}]`;
  if (!isPlainObject(value)) return value === undefined ? "undefined" : JSON.stringify(value);
  const fields: AstNodeFields = value;
  return `{${namedFieldsOf(fields)
    .map(([field, nested]) => `${field}:${structureOf(nested)}`)
    .join(",")}}`;
};

const nodeCountOf = (value: unknown): number => {
  if (Array.isArray(value))
    return value.reduce<number>((total, item) => total + nodeCountOf(item), 0);
  if (!isPlainObject(value)) return 0;
  const fields: AstNodeFields = value;
  const own = typeof fields[NODE_TYPE_FIELD] === "string" ? 1 : 0;
  return namedFieldsOf(fields).reduce((total, [, nested]) => total + nodeCountOf(nested), own);
};

const declarationFrom = ({
  source,
  described,
}: {
  readonly source: string;
  readonly described: { readonly name: string; readonly start: number; readonly body: unknown };
}): BodyDeclaration => ({
  name: described.name,
  line: lineAtOffset(source, described.start),
  structure: structureOf(described.body),
  nodeCount: nodeCountOf(described.body),
});

const bindingsOf = (statement: AstNodeFields): readonly AstNodeFields[] => {
  const { declarations } = statement;
  return Array.isArray(declarations)
    ? (declarations.filter(isPlainObject) as readonly AstNodeFields[])
    : [];
};

const namedBindingIn = (binding: AstNodeFields): string | null => {
  const { id } = binding;
  if (!isPlainObject(id)) return null;
  const idFields: AstNodeFields = id;
  if (idFields[NODE_TYPE_FIELD] !== "Identifier") return null;
  return typeof idFields.name === "string" ? idFields.name : null;
};

const bindingBodyOf = (binding: AstNodeFields): unknown => {
  const { id, init } = binding;
  const idFields: AstNodeFields | null = isPlainObject(id) ? id : null;
  const typeAnnotation: unknown = idFields?.typeAnnotation ?? null;
  const initializer: unknown = init ?? null;
  return { typeAnnotation, init: initializer };
};

const functionBodyOf = (statement: AstNodeFields): unknown => ({
  typeParameters: statement.typeParameters ?? null,
  params: statement.params ?? null,
  returnType: statement.returnType ?? null,
  body: statement.body ?? null,
  async: statement.async ?? false,
  generator: statement.generator ?? false,
});

const typeAliasBodyOf = (statement: AstNodeFields): unknown => ({
  typeParameters: statement.typeParameters ?? null,
  typeAnnotation: statement.typeAnnotation ?? null,
});

const interfaceBodyOf = (statement: AstNodeFields): unknown => ({
  typeParameters: statement.typeParameters ?? null,
  extends: statement.extends ?? null,
  body: statement.body ?? null,
});

const BODY_BY_STATEMENT_KIND: Readonly<Record<string, (statement: AstNodeFields) => unknown>> = {
  FunctionDeclaration: functionBodyOf,
  TSInterfaceDeclaration: interfaceBodyOf,
  TSTypeAliasDeclaration: typeAliasBodyOf,
};

const declaredNameOf = (statement: AstNodeFields): string | null => {
  const { id } = statement;
  if (!isPlainObject(id)) return null;
  const idFields: AstNodeFields = id;
  return typeof idFields.name === "string" ? idFields.name : null;
};

const startOf = (statement: AstNodeFields): number =>
  typeof statement.start === "number" ? statement.start : 0;

const bindingDeclarationsIn = (
  source: string,
  statement: AstNodeFields,
): readonly BodyDeclaration[] =>
  bindingsOf(statement).flatMap((binding) => {
    const name = namedBindingIn(binding);
    if (name === null) return [];
    return [
      declarationFrom({
        source,
        described: { name, start: startOf(statement), body: bindingBodyOf(binding) },
      }),
    ];
  });

const namedDeclarationsIn = (
  source: string,
  statement: AstNodeFields,
): readonly BodyDeclaration[] => {
  const kind = statement[NODE_TYPE_FIELD];
  const bodyOf = typeof kind === "string" ? BODY_BY_STATEMENT_KIND[kind] : undefined;
  if (bodyOf === undefined) return [];

  const name = declaredNameOf(statement);
  if (name === null) return [];
  return [
    declarationFrom({
      source,
      described: { name, start: startOf(statement), body: bodyOf(statement) },
    }),
  ];
};

const declarationsFromStatement = (
  source: string,
  statement: unknown,
): readonly BodyDeclaration[] => {
  if (!isPlainObject(statement)) return [];
  const fields: AstNodeFields = statement;

  const kind: unknown = fields[NODE_TYPE_FIELD];
  if (kind === "ExportNamedDeclaration") {
    return declarationsFromStatement(source, fields.declaration);
  }
  if (kind === "VariableDeclaration") return bindingDeclarationsIn(source, fields);
  return namedDeclarationsIn(source, fields);
};

export const declarationsIn = (source: string): readonly BodyDeclaration[] => {
  const parsed = parseSync(DEFAULT_SOURCE_NAME, source);
  return parsed.program.body.flatMap((statement) => declarationsFromStatement(source, statement));
};
