import { parseSync } from "oxc-parser";

import { NODE_TYPE_FIELD } from "../ast-node.ts";

import type { UnknownFields } from "@mst/lint-rule-authoring";

export type BodyDeclaration = {
  readonly name: string;
  readonly line: number;
  readonly structure: string;
  readonly nodeCount: number;
};

const DEFAULT_SOURCE_NAME = "source.tsx";

const POSITION_FIELDS: ReadonlySet<string> = new Set(["start", "end", "range", "loc"]);

const isNode = (candidate: unknown): candidate is UnknownFields =>
  candidate !== null && typeof candidate === "object" && !Array.isArray(candidate);

const namedFieldsOf = (node: UnknownFields): readonly (readonly [string, unknown])[] =>
  Object.entries(node).filter(([field]) => !POSITION_FIELDS.has(field));

const jsonTextOf: (value: unknown) => string = JSON.stringify;

const structureOf = (held: unknown): string => {
  if (Array.isArray(held)) return `[${held.map(structureOf).join(",")}]`;
  if (!isNode(held)) return jsonTextOf(held);
  return `{${namedFieldsOf(held)
    .map(([field, nested]) => `${field}:${structureOf(nested)}`)
    .join(",")}}`;
};

const nodeCountOf = (held: unknown): number => {
  if (Array.isArray(held))
    return held.reduce<number>((counted, member) => counted + nodeCountOf(member), 0);
  if (!isNode(held)) return 0;
  const own = typeof held[NODE_TYPE_FIELD] === "string" ? 1 : 0;
  return namedFieldsOf(held).reduce((counted, [, nested]) => counted + nodeCountOf(nested), own);
};

const declarationFrom = ({
  source,
  described,
}: {
  readonly source: string;
  readonly described: { readonly name: string; readonly start: number; readonly body: unknown };
}): BodyDeclaration => ({
  name: described.name,
  line: source.slice(0, described.start).split("\n").length,
  structure: structureOf(described.body),
  nodeCount: nodeCountOf(described.body),
});

const bindingsOf = (statement: UnknownFields): readonly UnknownFields[] =>
  (statement.declarations as readonly unknown[]).filter(isNode);

const namedBindingIn = (binding: UnknownFields): string | null => {
  const bound = binding.id as UnknownFields;
  return bound[NODE_TYPE_FIELD] === "Identifier" ? String(bound.name) : null;
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
    const bindingName = namedBindingIn(binding);
    if (bindingName === null) return [];
    return [
      declarationFrom({
        source,
        described: { name: bindingName, start: startOf(statement), body: bindingBodyOf(binding) },
      }),
    ];
  });

const namedDeclarationsIn = (
  source: string,
  statement: UnknownFields,
): readonly BodyDeclaration[] => {
  const bodyOf = BODY_BY_STATEMENT_KIND[String(statement[NODE_TYPE_FIELD])];
  if (bodyOf === undefined) return [];

  const declaredName = declaredNameOf(statement);
  return [
    declarationFrom({
      source,
      described: { name: declaredName, start: startOf(statement), body: bodyOf(statement) },
    }),
  ];
};

const declarationsFromStatement = (
  source: string,
  statement: unknown,
): readonly BodyDeclaration[] => {
  if (!isNode(statement)) return [];

  const statementType = statement[NODE_TYPE_FIELD];
  if (statementType === "ExportNamedDeclaration") {
    return declarationsFromStatement(source, statement.declaration);
  }
  if (statementType === "VariableDeclaration") return bindingDeclarationsIn(source, statement);
  return namedDeclarationsIn(source, statement);
};

export const declarationsIn = (source: string): readonly BodyDeclaration[] => {
  const parsedProgram = parseSync(DEFAULT_SOURCE_NAME, source);
  return parsedProgram.program.body.flatMap((statement) =>
    declarationsFromStatement(source, statement),
  );
};
