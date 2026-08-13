import { memoize } from "es-toolkit";

import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";
import { boundNamesIn } from "./bound-names.ts";

import type { ImportRoutes } from "./import-routes.ts";

type Spelling = (name: string) => string;

const UNCOMPARED_FIELDS: ReadonlySet<string> = new Set([
  "end",
  "loc",
  "range",
  "shorthand",
  "start",
]);

const MEMBER_NAME_FIELDS: ReadonlySet<string> = new Set(["key", "property"]);

const NAME_FIELD = "name";

const PLACEHOLDER_PREFIX = "$";

const asWritten: Spelling = (identifierName) => identifierName;

const jsonTextOf: (held: unknown) => string = JSON.stringify;

const namesAMember = (node: AstFields, field: string): boolean =>
  MEMBER_NAME_FIELDS.has(field) && node.computed === false;

const structureOf = (held: unknown, spell: Spelling): string => {
  if (Array.isArray(held)) return `[${held.map((child) => structureOf(child, spell)).join(",")}]`;
  if (!isAstFields(held)) return jsonTextOf(held);

  const namesABinding = held[NODE_TYPE_FIELD] === "Identifier";
  return `{${Object.entries(held)
    .filter(([field]) => !UNCOMPARED_FIELDS.has(field))
    .map(([field, nested]) =>
      namesABinding && field === NAME_FIELD
        ? `${field}:${jsonTextOf(spell(String(nested)))}`
        : `${field}:${structureOf(nested, namesAMember(held, field) ? asWritten : spell)}`,
    )
    .join(",")}}`;
};

export const normalizedBodyOf = (input: {
  readonly body: unknown;
  readonly routes: ImportRoutes;
}): string => {
  const bound = boundNamesIn(input.body);
  const placeholderByName = new Map<string, string>();
  const placeholderFor = memoize(
    (boundName: string): string =>
      `${PLACEHOLDER_PREFIX}${[...placeholderByName.keys(), boundName].indexOf(boundName)}`,
    { cache: placeholderByName },
  );

  const spell: Spelling = (identifierName) =>
    bound.has(identifierName)
      ? placeholderFor(identifierName)
      : (input.routes.get(identifierName) ?? identifierName);

  return structureOf(input.body, spell);
};
