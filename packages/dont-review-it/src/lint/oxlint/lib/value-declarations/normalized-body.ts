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

const asWritten: Spelling = (spelled) => spelled;

const jsonTextOf: (held: unknown) => string = JSON.stringify;

const namesAMember = (node: AstFields, field: string): boolean =>
  MEMBER_NAME_FIELDS.has(field) && node.computed === false;

const structureOf = (held: unknown, spell: Spelling): string => {
  if (Array.isArray(held)) return `[${held.map((member) => structureOf(member, spell)).join(",")}]`;
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

  const spell: Spelling = (spelled) => {
    if (!bound.has(spelled)) return input.routes.get(spelled) ?? spelled;

    const held = placeholderByName.get(spelled);
    if (held !== undefined) return held;

    const minted = `${PLACEHOLDER_PREFIX}${placeholderByName.size}`;
    placeholderByName.set(spelled, minted);
    return minted;
  };

  return structureOf(input.body, spell);
};
