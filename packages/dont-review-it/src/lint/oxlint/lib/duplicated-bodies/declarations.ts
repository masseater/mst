import { lineAtOffset } from "@mst/utils";
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

type Fields = Readonly<Record<string, unknown>>;

const isNode = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const namedFieldsOf = (node: Fields): readonly (readonly [string, unknown])[] =>
  Object.entries(node).filter(([field]) => !POSITION_FIELDS.has(field));

const structureOf = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(structureOf).join(",")}]`;
  if (!isNode(value)) {
    if (value === undefined) return "undefined";
    return typeof value === "bigint" ? `bigint:${String(value)}` : JSON.stringify(value);
  }
  return `{${namedFieldsOf(value)
    .map(([field, nested]) => `${field}:${structureOf(nested)}`)
    .join(",")}}`;
};

const nodeCountOf = (value: unknown): number => {
  if (Array.isArray(value))
    return value.reduce<number>((total, item) => total + nodeCountOf(item), 0);
  if (!isNode(value)) return 0;
  const own = typeof value[NODE_TYPE_FIELD] === "string" ? 1 : 0;
  return namedFieldsOf(value).reduce((total, [, nested]) => total + nodeCountOf(nested), own);
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

const bindingsOf = (statement: Fields): readonly Fields[] => {
  const { declarations } = statement;
  return Array.isArray(declarations) ? declarations.filter(isNode) : [];
};

const namedBindingIn = (binding: Fields): string | null => {
  const { id } = binding;
  if (!isNode(id) || id[NODE_TYPE_FIELD] !== "Identifier") return null;
  return typeof id.name === "string" ? id.name : null;
};

const bindingBodyOf = (binding: Fields): unknown => {
  const { id, init } = binding;
  const typeAnnotation = isNode(id) ? (id.typeAnnotation ?? null) : null;
  return { typeAnnotation, init: init ?? null };
};

const functionBodyOf = (statement: Fields): unknown => ({
  typeParameters: statement.typeParameters ?? null,
  params: statement.params ?? null,
  returnType: statement.returnType ?? null,
  body: statement.body ?? null,
  async: statement.async ?? false,
  generator: statement.generator ?? false,
});

const typeAliasBodyOf = (statement: Fields): unknown => ({
  typeParameters: statement.typeParameters ?? null,
  typeAnnotation: statement.typeAnnotation ?? null,
});

const interfaceBodyOf = (statement: Fields): unknown => ({
  typeParameters: statement.typeParameters ?? null,
  extends: statement.extends ?? null,
  body: statement.body ?? null,
});

const BODY_BY_STATEMENT_KIND: Readonly<Record<string, (statement: Fields) => unknown>> = {
  FunctionDeclaration: functionBodyOf,
  TSInterfaceDeclaration: interfaceBodyOf,
  TSTypeAliasDeclaration: typeAliasBodyOf,
};

const declaredNameOf = (statement: Fields): string | null => {
  const { id } = statement;
  if (!isNode(id)) return null;
  return typeof id.name === "string" ? id.name : null;
};

const startOf = (statement: Fields): number =>
  typeof statement.start === "number" ? statement.start : 0;

const bindingDeclarationsIn = (source: string, statement: Fields): readonly BodyDeclaration[] =>
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

const namedDeclarationsIn = (source: string, statement: Fields): readonly BodyDeclaration[] => {
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
  if (!isNode(statement)) return [];

  const kind = statement[NODE_TYPE_FIELD];
  if (kind === "ExportNamedDeclaration") {
    return declarationsFromStatement(source, statement.declaration);
  }
  if (kind === "VariableDeclaration") return bindingDeclarationsIn(source, statement);
  return namedDeclarationsIn(source, statement);
};

export const declarationsIn = (source: string): readonly BodyDeclaration[] => {
  const parsed = parseSync(DEFAULT_SOURCE_NAME, source);
  return parsed.program.body.flatMap((statement) => declarationsFromStatement(source, statement));
};
