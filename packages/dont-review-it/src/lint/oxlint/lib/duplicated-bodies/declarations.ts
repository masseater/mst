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

const isNode = (syntaxField: unknown): syntaxField is UnknownFields =>
  syntaxField !== null && typeof syntaxField === "object" && !Array.isArray(syntaxField);

const namedFieldsOf = (node: UnknownFields): readonly (readonly [string, unknown])[] =>
  Object.entries(node).filter(
    ([field, nestedField]) => !POSITION_FIELDS.has(field) && nestedField !== undefined,
  );

const structureOf = (syntaxField: unknown): string => {
  if (Array.isArray(syntaxField)) return `[${syntaxField.map(structureOf).join(",")}]`;
  if (!isNode(syntaxField)) {
    return typeof syntaxField === "bigint"
      ? `bigint:${String(syntaxField)}`
      : JSON.stringify(syntaxField);
  }
  return `{${namedFieldsOf(syntaxField)
    .map(([field, nested]) => `${field}:${structureOf(nested)}`)
    .join(",")}}`;
};

const nodeCountOf = (syntaxField: unknown): number => {
  if (Array.isArray(syntaxField))
    return syntaxField.reduce<number>(
      (accumulatedCount, nestedItem) => accumulatedCount + nodeCountOf(nestedItem),
      0,
    );
  if (!isNode(syntaxField)) return 0;
  const own = typeof syntaxField[NODE_TYPE_FIELD] === "string" ? 1 : 0;
  return namedFieldsOf(syntaxField).reduce(
    (accumulatedCount, [, nested]) => accumulatedCount + nodeCountOf(nested),
    own,
  );
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
  const bindingIdentifier = binding.id as UnknownFields;
  return bindingIdentifier[NODE_TYPE_FIELD] === "Identifier"
    ? String(bindingIdentifier.name)
    : null;
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
    const declarationName = namedBindingIn(binding);
    if (declarationName === null) return [];
    return [
      declarationFrom({
        source,
        described: {
          name: declarationName,
          start: startOf(statement),
          body: bindingBodyOf(binding),
        },
      }),
    ];
  });

const namedDeclarationsIn = (
  source: string,
  statement: UnknownFields,
): readonly BodyDeclaration[] => {
  const bodyOf = BODY_BY_STATEMENT_KIND[String(statement[NODE_TYPE_FIELD])];
  if (bodyOf === undefined) return [];

  const declarationName = declaredNameOf(statement);
  return [
    declarationFrom({
      source,
      described: { name: declarationName, start: startOf(statement), body: bodyOf(statement) },
    }),
  ];
};

const declarationsFromStatement = (
  source: string,
  statement: unknown,
): readonly BodyDeclaration[] => {
  if (!isNode(statement)) return [];

  const statementKind = statement[NODE_TYPE_FIELD];
  if (statementKind === "ExportNamedDeclaration") {
    return declarationsFromStatement(source, statement.declaration);
  }
  if (statementKind === "VariableDeclaration") return bindingDeclarationsIn(source, statement);
  return namedDeclarationsIn(source, statement);
};

export const declarationsIn = (source: string): readonly BodyDeclaration[] => {
  const parsedSource = parseSync(DEFAULT_SOURCE_NAME, source);
  return parsedSource.program.body.flatMap((statement) =>
    declarationsFromStatement(source, statement),
  );
};
