import { parseSync } from "oxc-parser";

import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";
import { importRoutesIn, type ImportRoutes } from "./import-routes.ts";
import { normalizedBodyOf } from "./normalized-body.ts";

const declaredNameOf = (node: AstFields): string | null => {
  const named = node.id;
  if (!isAstFields(named) || named[NODE_TYPE_FIELD] !== "Identifier") return null;
  return String(named.name);
};

const boundNodesOf = (statement: AstFields): readonly AstFields[] =>
  statement[NODE_TYPE_FIELD] === "VariableDeclaration"
    ? (statement.declarations as readonly unknown[]).filter(isAstFields)
    : [statement];

const namesSentAwayIn = (statements: readonly AstFields[]): ReadonlySet<string> =>
  new Set(
    statements
      .filter(
        (statement) =>
          statement[NODE_TYPE_FIELD] === "ExportNamedDeclaration" && statement.source === null,
      )
      .flatMap((statement) => (statement.specifiers as readonly unknown[]).filter(isAstFields))
      .map((specifier) => String((specifier.local as AstFields).name)),
  );

const exportedNodesIn = (statements: readonly AstFields[]): ReadonlySet<AstFields> => {
  const sentAway = namesSentAwayIn(statements);

  return new Set(
    statements.flatMap((statement) => {
      const declaring =
        statement[NODE_TYPE_FIELD] === "ExportNamedDeclaration" ? statement.declaration : statement;
      if (!isAstFields(declaring)) return [];
      if (declaring !== statement) return boundNodesOf(declaring);

      return boundNodesOf(declaring).filter((node) => {
        const spelled = declaredNameOf(node);
        return spelled !== null && sentAway.has(spelled);
      });
    }),
  );
};

export type ValueDeclaration = {
  readonly name: string;
  readonly line: number;
  readonly exported: boolean;
  readonly fingerprint: string;
};

type Reading = {
  readonly source: string;
  readonly routes: ImportRoutes;
  readonly exportedNodes: ReadonlySet<AstFields>;
};

const BODY_BY_KIND: Readonly<Record<string, (node: AstFields) => unknown>> = {
  ClassDeclaration: (node) => ({
    body: node.body,
    decorators: node.decorators,
    implements: node.implements,
    superClass: node.superClass,
    superTypeArguments: node.superTypeArguments,
    typeParameters: node.typeParameters,
  }),
  FunctionDeclaration: (node) => ({
    async: node.async,
    body: node.body,
    generator: node.generator,
    params: node.params,
    returnType: node.returnType,
    typeParameters: node.typeParameters,
  }),
  VariableDeclarator: (node) => ({
    annotation: (node.id as AstFields).typeAnnotation,
    init: node.init,
  }),
};

const valueDeclarationAt = (node: AstFields, reading: Reading): ValueDeclaration | null => {
  const bodyOf = BODY_BY_KIND[String(node[NODE_TYPE_FIELD])];
  if (bodyOf === undefined) return null;

  const spelled = declaredNameOf(node);
  if (spelled === null) return null;

  return {
    name: spelled,
    line: reading.source.slice(0, Number(node.start)).split("\n").length,
    exported: reading.exportedNodes.has(node),
    fingerprint: normalizedBodyOf({ body: bodyOf(node), routes: reading.routes }),
  };
};

const declarationsWithin = (held: unknown, reading: Reading): readonly ValueDeclaration[] => {
  if (Array.isArray(held)) return held.flatMap((member) => declarationsWithin(member, reading));
  if (!isAstFields(held)) return [];

  const declared = valueDeclarationAt(held, reading);
  return [
    ...(declared === null ? [] : [declared]),
    ...Object.values(held).flatMap((nested) => declarationsWithin(nested, reading)),
  ];
};

export const valueDeclarationsIn = (input: {
  readonly source: string;
  readonly relativePath: string;
}): readonly ValueDeclaration[] => {
  const statements: readonly unknown[] = parseSync(input.relativePath, input.source).program.body;

  return declarationsWithin(statements, {
    source: input.source,
    routes: importRoutesIn({ body: statements, relativePath: input.relativePath }),
    exportedNodes: exportedNodesIn(statements.filter(isAstFields)),
  });
};
