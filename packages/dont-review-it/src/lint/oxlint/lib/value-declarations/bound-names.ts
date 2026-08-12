import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";

const BOUND_FIELDS_BY_KIND: Readonly<Record<string, readonly string[]>> = {
  ArrowFunctionExpression: ["params"],
  CatchClause: ["param"],
  ClassDeclaration: ["id"],
  ClassExpression: ["id"],
  FunctionDeclaration: ["id", "params"],
  FunctionExpression: ["id", "params"],
  TSTypeParameter: ["name"],
  VariableDeclarator: ["id"],
};

const READ_ONLY_FIELDS: ReadonlySet<string> = new Set([
  "decorators",
  "key",
  "right",
  "typeAnnotation",
]);

const patternNamesIn = (pattern: unknown): readonly string[] => {
  if (Array.isArray(pattern)) return pattern.flatMap(patternNamesIn);
  if (!isAstFields(pattern)) return [];
  if (pattern[NODE_TYPE_FIELD] === "Identifier") return [String(pattern.name)];

  return Object.entries(pattern)
    .filter(([field]) => !READ_ONLY_FIELDS.has(field))
    .flatMap(([, nested]) => patternNamesIn(nested));
};

const namesBoundAt = (node: AstFields): readonly string[] =>
  (BOUND_FIELDS_BY_KIND[String(node[NODE_TYPE_FIELD])] ?? []).flatMap((field) =>
    patternNamesIn(node[field]),
  );

const namesBoundWithin = (held: unknown): readonly string[] => {
  if (Array.isArray(held)) return held.flatMap(namesBoundWithin);
  if (!isAstFields(held)) return [];
  return [...namesBoundAt(held), ...Object.values(held).flatMap(namesBoundWithin)];
};

export const boundNamesIn = (writtenBody: unknown): ReadonlySet<string> =>
  new Set(namesBoundWithin(writtenBody));
