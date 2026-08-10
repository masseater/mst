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

const lineAt = (source: string, offset: number): number =>
  source.slice(0, offset).split("\n").length;

const declarationFrom = ({
  source,
  described,
}: {
  readonly source: string;
  readonly described: { readonly name: string; readonly start: number; readonly body: unknown };
}): BodyDeclaration => ({
  name: described.name,
  line: lineAt(source, described.start),
  structure: structureOf(described.body),
  nodeCount: nodeCountOf(described.body),
});

const bindingsOf = (statement: Fields): readonly Fields[] =>
  (statement.declarations as readonly unknown[]).filter(isNode);

const namedBindingIn = (binding: Fields): string | null => {
  const id = binding.id as Fields;
  return id[NODE_TYPE_FIELD] === "Identifier" ? String(id.name) : null;
};

const bindingBodyOf = (binding: Fields): unknown => ({
  typeAnnotation: (binding.id as Fields).typeAnnotation,
  init: binding.init,
});

const functionBodyOf = (statement: Fields): unknown => ({
  typeParameters: statement.typeParameters,
  params: statement.params,
  returnType: statement.returnType,
  body: statement.body,
  async: statement.async,
  generator: statement.generator,
});

const typeAliasBodyOf = (statement: Fields): unknown => ({
  typeParameters: statement.typeParameters,
  typeAnnotation: statement.typeAnnotation,
});

const interfaceBodyOf = (statement: Fields): unknown => ({
  typeParameters: statement.typeParameters,
  extends: statement.extends,
  body: statement.body,
});

const BODY_BY_STATEMENT_KIND: Readonly<Record<string, (statement: Fields) => unknown>> = {
  FunctionDeclaration: functionBodyOf,
  TSInterfaceDeclaration: interfaceBodyOf,
  TSTypeAliasDeclaration: typeAliasBodyOf,
};

const declaredNameOf = (statement: Fields): string => String((statement.id as Fields).name);

const startOf = (statement: Fields): number => Number(statement.start);

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
