import { uniq } from "es-toolkit";

import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";

const SPAN_FIELDS: ReadonlySet<string> = new Set(["end", "loc", "range", "start"]);

const TYPE_PARAMETER_KIND = "TSTypeParameter";

const TYPE_REFERENCE_KIND = "TSTypeReference";

const PLACEHOLDER_PREFIX = "#";

const REFERENCE_TAG = "ref";

const PARAMETER_TAG = "param";

const UNORDERED_LISTS: ReadonlyMap<string, { readonly tag: string; readonly field: string }> =
  new Map([
    ["TSIntersectionType", { tag: "all", field: "types" }],
    ["TSTypeLiteral", { tag: "members", field: "members" }],
    ["TSUnionType", { tag: "any", field: "types" }],
  ]);

export type TypeParameterPlaceholders = ReadonlyMap<string, string>;

const comparedFieldsOf = (node: AstFields): readonly (readonly [string, unknown])[] =>
  Object.entries(node).filter(([field]) => !SPAN_FIELDS.has(field));

const declaredParameterNameOf = (node: AstFields): string => String((node.name as AstFields).name);

const referencedNameOf = (node: AstFields): string | null => {
  const typeName = node.typeName as AstFields;
  return typeName[NODE_TYPE_FIELD] === "Identifier" ? String(typeName.name) : null;
};

const namesIn = (
  node: unknown,
  pickedNamesOf: (node: AstFields) => readonly string[],
): string[] => {
  if (Array.isArray(node)) return node.flatMap((member) => namesIn(member, pickedNamesOf));
  if (!isAstFields(node)) return [];
  return [
    ...pickedNamesOf(node),
    ...comparedFieldsOf(node).flatMap(([, held]) => namesIn(held, pickedNamesOf)),
  ];
};

const declaredParameterNamesOf = (node: AstFields): readonly string[] =>
  node[NODE_TYPE_FIELD] === TYPE_PARAMETER_KIND ? [declaredParameterNameOf(node)] : [];

const referencedNamesOf = (node: AstFields): readonly string[] => {
  if (node[NODE_TYPE_FIELD] !== TYPE_REFERENCE_KIND) return [];
  const referenced = referencedNameOf(node);
  return referenced === null ? [] : [referenced];
};

export const placeholdersIn = (node: unknown): TypeParameterPlaceholders =>
  new Map(
    uniq(namesIn(node, declaredParameterNamesOf)).map((spelled, position) => [
      spelled,
      `${PLACEHOLDER_PREFIX}${position}`,
    ]),
  );

export const referencedTypeNamesIn = (node: unknown): readonly string[] =>
  namesIn(node, referencedNamesOf);

const boundNameOf = (placeholders: TypeParameterPlaceholders, spelled: string): string =>
  placeholders.get(spelled) ?? spelled;

export const canonicalTextOf = (node: unknown, placeholders: TypeParameterPlaceholders): string => {
  if (Array.isArray(node)) {
    return `[${node.map((member) => canonicalTextOf(member, placeholders)).join(",")}]`;
  }
  if (!isAstFields(node)) return JSON.stringify(node);

  const nodeKind = String(node[NODE_TYPE_FIELD]);
  const unordered = UNORDERED_LISTS.get(nodeKind);
  if (unordered !== undefined) {
    return `${unordered.tag}{${(node[unordered.field] as readonly unknown[])
      .map((member) => canonicalTextOf(member, placeholders))
      .toSorted()
      .join(",")}}`;
  }
  if (nodeKind === TYPE_REFERENCE_KIND) return typeReferenceTextOf(node, placeholders);
  if (nodeKind === TYPE_PARAMETER_KIND) return typeParameterTextOf(node, placeholders);

  return `{${comparedFieldsOf(node)
    .map(([field, held]) => `${field}:${canonicalTextOf(held, placeholders)}`)
    .join(",")}}`;
};

const typeReferenceTextOf = (node: AstFields, placeholders: TypeParameterPlaceholders): string => {
  const referenced = referencedNameOf(node);
  const head =
    referenced === null
      ? canonicalTextOf(node.typeName, placeholders)
      : boundNameOf(placeholders, referenced);
  return `${REFERENCE_TAG}(${head},${canonicalTextOf(node.typeArguments, placeholders)})`;
};

const typeParameterTextOf = (node: AstFields, placeholders: TypeParameterPlaceholders): string =>
  [
    PARAMETER_TAG,
    boundNameOf(placeholders, declaredParameterNameOf(node)),
    canonicalTextOf(node.constraint, placeholders),
    canonicalTextOf(node.default, placeholders),
    JSON.stringify([node.in, node.out, node.const]),
  ].join("|");
