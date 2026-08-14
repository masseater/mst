import { staticPropertyName, staticSpelling } from "./static-names.ts";
import { unwrapSubject } from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

export const TABLE_DRIVEN_MEMBERS: ReadonlySet<string> = new Set(["each", "for"]);

export type TableDrivenTitles =
  | { readonly kind: "spelled"; readonly titles: readonly string[] }
  | { readonly kind: "runtime" }
  | { readonly kind: "unreadable" };

type CaseValue = string | number | boolean | null;

const scalarValueOf = (candidate: unknown): { readonly held: CaseValue } | null => {
  if (candidate === null) return { held: null };
  if (typeof candidate === "string") return { held: candidate };
  if (typeof candidate === "number") return { held: candidate };
  return typeof candidate === "boolean" ? { held: candidate } : null;
};

const negatedNumberOf = (node: ESTree.Expression): number | null => {
  if (node.type !== "UnaryExpression" || node.operator !== "-") return null;
  const operand = unwrapSubject(node.argument);
  if (operand.type !== "Literal" || typeof operand.value !== "number") return null;
  return -operand.value;
};

const scalarOf = (node: ESTree.Expression): { readonly held: CaseValue } | null => {
  const written = unwrapSubject(node);
  if (written.type === "Literal") return scalarValueOf(written.value);

  const negated = negatedNumberOf(written);
  if (negated !== null) return { held: negated };

  const spelled = staticSpelling(written);
  return spelled === null ? null : { held: spelled };
};

const namedEntryOf = (property: ESTree.ObjectExpression["properties"][number]) => {
  if (property.type !== "Property" || property.computed) return null;

  const propertyName = staticPropertyName(property);
  if (propertyName === null) return null;

  const scalar = property.value.type === "Identifier" ? null : scalarOf(property.value);
  return scalar === null ? null : ([propertyName, scalar.held] as const);
};

const namedValuesOf = (
  caseObject: ESTree.ObjectExpression,
): ReadonlyMap<string, CaseValue> | null => {
  const held = caseObject.properties.map(namedEntryOf);
  return held.every((named) => named !== null) ? new Map(held) : null;
};

type CaseRow = {
  readonly positional: readonly CaseValue[];
  readonly named: ReadonlyMap<string, CaseValue> | null;
};

const positionalRowOf = (caseArray: ESTree.ArrayExpression): CaseRow | null => {
  const held = caseArray.elements.map((caseElement) =>
    caseElement === null || caseElement.type === "SpreadElement" ? null : scalarOf(caseElement),
  );
  return held.every((scalar) => scalar !== null)
    ? { positional: held.map((scalar) => scalar.held), named: null }
    : null;
};

const rowOf = (caseElement: ESTree.Expression): CaseRow | null => {
  const written = unwrapSubject(caseElement);
  if (written.type === "ArrayExpression") return positionalRowOf(written);
  if (written.type === "ObjectExpression") {
    const named = namedValuesOf(written);
    return named === null ? null : { positional: [], named };
  }

  const scalar = scalarOf(written);
  return scalar === null ? null : { positional: [scalar.held], named: null };
};

const INDEX_PLACEHOLDERS: ReadonlyMap<string, (index: number) => string> = new Map([
  ["%#", (index) => String(index)],
  ["%$", (index) => String(index + 1)],
]);

const indexFilled = (template: string, index: number): string =>
  template
    .split(/(%%|%#|%\$)/u)
    .map((piece) => INDEX_PLACEHOLDERS.get(piece)?.(index) ?? piece)
    .join("");

const POSITIONAL_SPELLINGS: ReadonlyMap<string, (held: CaseValue) => string | null> = new Map([
  ["%s", (held) => String(held)],
  ["%d", (held) => (typeof held === "number" ? String(held) : null)],
  ["%i", (held) => (typeof held === "number" ? String(Math.trunc(held)) : null)],
]);

const positionallyFilled = (template: string, caseRow: CaseRow): string | null =>
  template.split(/(%[a-zA-Z%])/u).reduce<{ readonly text: string; readonly taken: number } | null>(
    (carried, piece) => {
      if (carried === null) return null;
      if (piece === "%%") return { text: `${carried.text}%`, taken: carried.taken };

      const spell = POSITIONAL_SPELLINGS.get(piece);
      if (spell === undefined) {
        return /^%[a-zA-Z]$/u.test(piece)
          ? null
          : { text: carried.text + piece, taken: carried.taken };
      }

      const held = caseRow.positional[carried.taken];
      const spelled = held === undefined ? null : spell(held);
      return spelled === null ? null : { text: carried.text + spelled, taken: carried.taken + 1 };
    },
    { text: "", taken: 0 },
  )?.text ?? null;

const DISPLAYED_TEXT = /^[\w \-.:/]{0,20}$/u;

const displayedValue = (held: CaseValue): string | null => {
  if (typeof held !== "string") return String(held);
  return DISPLAYED_TEXT.test(held) ? `'${held}'` : null;
};

const propertyFilled = (template: string, caseRow: CaseRow): string | null => {
  const { named } = caseRow;
  if (named === null) return template;

  return template.split(/(\$[$\w.]+)/u).reduce<string | null>((carried, piece) => {
    if (carried === null) return null;
    if (!piece.startsWith("$")) return carried + piece;

    const held = named.get(piece.slice(1));
    const displayed = held === undefined ? null : displayedValue(held);
    return displayed === null ? null : carried + displayed;
  }, "");
};

const titleOf = ({
  template,
  row,
  index,
}: {
  readonly template: string;
  readonly row: CaseRow;
  readonly index: number;
}): string | null => {
  const positional = positionallyFilled(indexFilled(template, index), row);
  return positional === null ? null : propertyFilled(positional, row);
};

export const tableDrivenTitlesOf = (
  table: ESTree.Expression,
  template: string,
): TableDrivenTitles => {
  const written = unwrapSubject(table);
  if (written.type !== "ArrayExpression") return { kind: "runtime" };

  const caseRows = written.elements.map((caseElement) =>
    caseElement === null || caseElement.type === "SpreadElement" ? null : rowOf(caseElement),
  );
  if (!caseRows.every((caseRow) => caseRow !== null)) return { kind: "runtime" };

  const titles = caseRows.map((caseRow, index) => titleOf({ template, row: caseRow, index }));
  return titles.every((title) => title !== null)
    ? { kind: "spelled", titles }
    : { kind: "unreadable" };
};
