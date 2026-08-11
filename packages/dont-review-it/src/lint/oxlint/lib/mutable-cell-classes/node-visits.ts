import { astFieldsOf, listedFieldsOf, nodeTypeOf } from "../setup-modules/coupling-edges.ts";

import type { AstFields } from "../ast-node.ts";

export type NodeVisit = {
  readonly node: AstFields;
  readonly ancestors: readonly AstFields[];
};

const POSITION_FIELDS: ReadonlySet<string> = new Set([
  "comments",
  "end",
  "loc",
  "parent",
  "range",
  "start",
  "tokens",
]);

const TYPE_BEARING_FIELDS: ReadonlySet<string> = new Set([
  "implements",
  "returnType",
  "superTypeArguments",
  "typeAnnotation",
  "typeArguments",
  "typeName",
  "typeParameters",
]);

const isWalkedField = (field: string): boolean =>
  !POSITION_FIELDS.has(field) && !TYPE_BEARING_FIELDS.has(field);

const visitsUnder = (held: unknown, ancestors: readonly AstFields[]): readonly NodeVisit[] =>
  listedFieldsOf(held)
    .filter((node) => nodeTypeOf(node) !== "")
    .flatMap((node) => [
      { node, ancestors },
      ...Object.entries(node)
        .filter(([field]) => isWalkedField(field))
        .flatMap(([, nested]) => visitsUnder(nested, [...ancestors, node])),
    ]);

export const nodeVisitsIn = (root: unknown): readonly NodeVisit[] => visitsUnder(root, []);

export const fieldOf = (held: unknown, field: string): unknown =>
  listedFieldsOf(held).flatMap((node) => [node[field]])[0];

export const kindAt = (held: unknown): string => {
  const node = astFieldsOf(held);
  return node === null ? "" : nodeTypeOf(node);
};

export const chainFrom = (visit: NodeVisit, boundary: AstFields): readonly AstFields[] => {
  const at = visit.ancestors.indexOf(boundary);
  return at === -1 ? visit.ancestors : visit.ancestors.slice(at);
};

export const visitAt = (visit: NodeVisit, ancestor: AstFields): NodeVisit => ({
  node: ancestor,
  ancestors: visit.ancestors.slice(0, visit.ancestors.indexOf(ancestor)),
});

export const innermostOf = (
  ancestors: readonly AstFields[],
  wanted: ReadonlySet<string>,
): AstFields | null => ancestors.findLast((held) => wanted.has(nodeTypeOf(held))) ?? null;
