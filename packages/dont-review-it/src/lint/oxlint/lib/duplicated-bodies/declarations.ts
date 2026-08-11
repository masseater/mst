import { lineAtOffset, type UnknownFields } from "@mst/utils";
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

const isNode = (value: unknown): value is UnknownFields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const namedFieldsOf = (node: UnknownFields): readonly (readonly [string, unknown])[] =>
  Object.entries(node).filter(([field]) => !POSITION_FIELDS.has(field));

const jsonTextOf: (value: unknown) => string = JSON.stringify;

const structureOf = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(structureOf).join(",")}]`;
  if (!isNode(value)) return jsonTextOf(value);
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

const bindingsOf = (statement: UnknownFields): readonly UnknownFields[] =>
  (statement.declarations as readonly unknown[]).filter(isNode);

const namedBindingIn = (binding: UnknownFields): string | null => {
  const id = binding.id as UnknownFields;
  return id[NODE_TYPE_FIELD] === "Identifier" ? String(id.name) : null;
};

const bindingBodyOf = (binding: UnknownFields): unknown => ({
  typeAnnotation: (binding.id as UnknownFields).typeAnnotation,
  init: binding.init,
});

const functionBodyOf = (statement: UnknownFields): unknown => ({
  typeParameters: statement.typeParameters,
  params: statement.params,
  returnType: statement.returnType,
  body: statement.body,
  async: statement.async,
  generator: statement.generator,
});

const typeAliasBodyOf = (statement: UnknownFields): unknown => ({
  typeParameters: statement.typeParameters,
  typeAnnotation: statement.typeAnnotation,
});

const interfaceBodyOf = (statement: UnknownFields): unknown => ({
  typeParameters: statement.typeParameters,
  extends: statement.extends,
  body: statement.body,
});

const BODY_BY_STATEMENT_KIND: Readonly<Record<string, (statement: UnknownFields) => unknown>> = {
  FunctionDeclaration: functionBodyOf,
  TSInterfaceDeclaration: interfaceBodyOf,
  TSTypeAliasDeclaration: typeAliasBodyOf,
};

const declaredNameOf = (statement: UnknownFields): string =>
  String((statement.id as UnknownFields).name);

const startOf = (statement: UnknownFields): number => Number(statement.start);

const bindingDeclarationsIn = (
  source: string,
  statement: UnknownFields,
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
  statement: UnknownFields,
): readonly BodyDeclaration[] => {
  const bodyOf = BODY_BY_STATEMENT_KIND[String(statement[NODE_TYPE_FIELD])];
  if (bodyOf === undefined) return [];

  const name = declaredNameOf(statement);
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
