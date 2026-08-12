import { flatMap, uniqBy } from "es-toolkit";

import {
  scalarLiteralValue,
  unwrapExpression,
} from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueFlowSources } from "./canonical-value-expression-flow.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueSourcePath } from "./canonical-value-binding-types.ts";
import type { CanonicalValueCallArgumentSource } from "./canonical-value-call-arguments.ts";

type IterationInput = {
  readonly resolveAlias: (identifier: ESTree.IdentifierReference) => readonly ESTree.Expression[];
  readonly source: ESTree.Expression;
};

type IterationRuntime = IterationInput & {
  readonly seen: ReadonlySet<ESTree.Expression>;
};

const syntheticString = (node: ESTree.Node, value: string): ESTree.StringLiteral => ({
  end: node.end,
  loc: node.loc,
  parent: node.parent ?? node,
  raw: JSON.stringify(value),
  range: node.range,
  start: node.start,
  type: "Literal",
  value,
});

const iterationSource = (
  expression: ESTree.Expression,
  sourcePath: CanonicalValueSourcePath = [],
): CanonicalValueCallArgumentSource => ({ expression, sourcePath });

const sourceKey = (source: CanonicalValueCallArgumentSource): string => {
  const expression = source.expression;
  const expressionIdentity =
    expression.type === "Literal"
      ? `${expression.start}:${expression.end}:${typeof expression.value}:${String(expression.value)}`
      : `${expression.start}:${expression.end}:${expression.type}`;
  return `${expressionIdentity}:${source.sourcePath.map((segment) => segment.kind).join("/")}`;
};

const distinctSources = (
  sources: readonly CanonicalValueCallArgumentSource[],
): readonly CanonicalValueCallArgumentSource[] => uniqBy(sources, sourceKey);

const nestedRuntime = (input: IterationRuntime, source: ESTree.Expression): IterationRuntime => ({
  ...input,
  seen: new Set([...input.seen, input.source]),
  source,
});

const aliasedSources = (input: IterationRuntime): readonly ESTree.Expression[] | null => {
  if (input.source.type !== "Identifier") return null;
  const sources = input.resolveAlias(input.source);
  return sources.length === 0 ? null : sources;
};

const forOfArrayCandidates = (
  input: IterationRuntime & { readonly source: ESTree.ArrayExpression },
): readonly CanonicalValueCallArgumentSource[] =>
  flatMap(input.source.elements, (element) => {
    if (element === null) return [iterationSource(input.source, [{ kind: "array-element" }])];
    if (element.type !== "SpreadElement") return [iterationSource(element)];
    return forOfCandidates(nestedRuntime(input, element.argument));
  });

const stringCharacters = (
  source: ESTree.Expression,
  primitive: string,
): readonly CanonicalValueCallArgumentSource[] =>
  Array.from(primitive, (character) => iterationSource(syntheticString(source, character)));

const forOfCandidates = (input: IterationRuntime): readonly CanonicalValueCallArgumentSource[] => {
  const source = unwrapExpression(input.source);
  if (input.seen.has(source)) return [iterationSource(source, [{ kind: "array-element" }])];
  if (source.type === "ArrayExpression") {
    return forOfArrayCandidates({ ...input, source });
  }
  const primitive = scalarLiteralValue(source);
  if (typeof primitive === "string") return stringCharacters(source, primitive);
  const aliases = aliasedSources({ ...input, source });
  if (aliases !== null)
    return flatMap(aliases, (alias) => forOfCandidates(nestedRuntime(input, alias)));
  const flows = canonicalValueFlowSources(source);
  return flows === null
    ? [iterationSource(source, [{ kind: "array-element" }])]
    : flatMap(flows, (flow) => forOfCandidates(nestedRuntime(input, flow)));
};

const forInCandidates = (input: IterationRuntime): readonly CanonicalValueCallArgumentSource[] => {
  const source = unwrapExpression(input.source);
  if (input.seen.has(source)) return [iterationSource(source, [{ kind: "property-name" }])];
  const aliases = aliasedSources({ ...input, source });
  if (aliases !== null)
    return flatMap(aliases, (alias) => forInCandidates(nestedRuntime(input, alias)));
  const flows = canonicalValueFlowSources(source);
  return flows === null
    ? [iterationSource(source, [{ kind: "property-name" }])]
    : flatMap(flows, (flow) => forInCandidates(nestedRuntime(input, flow)));
};

const staticObjectKey = (property: ESTree.ObjectProperty): string | null => {
  if (!property.computed && property.key.type === "Identifier") return property.key.name;
  const primitive = scalarLiteralValue(property.key as ESTree.Expression);
  return typeof primitive === "string" || typeof primitive === "number" ? String(primitive) : null;
};

const objectPropertyNameSources = (
  input: IterationRuntime & { readonly source: ESTree.ObjectExpression },
): readonly CanonicalValueCallArgumentSource[] =>
  flatMap(input.source.properties, (property) => {
    if (property.type === "SpreadElement") {
      return enumeratedForInCandidates(nestedRuntime(input, property.argument));
    }
    const key = staticObjectKey(property);
    return key === null
      ? [iterationSource(property.key as ESTree.Expression, [{ kind: "unknown" }])]
      : [iterationSource(syntheticString(property.key, key))];
  });

const arrayPropertyNameSources = (
  source: ESTree.ArrayExpression,
): readonly CanonicalValueCallArgumentSource[] =>
  source.elements.flatMap((element, index) =>
    element === null ? [] : [iterationSource(syntheticString(element, String(index)))],
  );

const stringPropertyNameSources = (
  source: ESTree.Expression,
  value: string,
): readonly CanonicalValueCallArgumentSource[] =>
  Array.from(value, (_character, index) => iterationSource(syntheticString(source, String(index))));

const staticForInCandidates = (
  input: IterationRuntime,
  source: ESTree.Expression,
): readonly CanonicalValueCallArgumentSource[] | null => {
  if (source.type === "ObjectExpression") return objectPropertyNameSources({ ...input, source });
  if (source.type === "ArrayExpression") return arrayPropertyNameSources(source);
  const primitive = scalarLiteralValue(source);
  return typeof primitive === "string" ? stringPropertyNameSources(source, primitive) : null;
};

const enumeratedForInCandidates = (
  input: IterationRuntime,
): readonly CanonicalValueCallArgumentSource[] => {
  const source = unwrapExpression(input.source);
  if (input.seen.has(source)) return [iterationSource(source, [{ kind: "property-name" }])];
  const direct = staticForInCandidates(input, source);
  if (direct !== null) return direct;
  const aliases = aliasedSources({ ...input, source });
  if (aliases !== null) {
    return flatMap(aliases, (alias) => enumeratedForInCandidates(nestedRuntime(input, alias)));
  }
  const flows = canonicalValueFlowSources(source);
  return flows === null
    ? [iterationSource(source, [{ kind: "property-name" }])]
    : flatMap(flows, (flow) => enumeratedForInCandidates(nestedRuntime(input, flow)));
};

export const canonicalValueForOfSources = (
  input: IterationInput,
): readonly CanonicalValueCallArgumentSource[] =>
  distinctSources(forOfCandidates({ ...input, seen: new Set() }));

export const canonicalValueForInSources = (
  input: IterationInput,
): readonly CanonicalValueCallArgumentSource[] =>
  distinctSources(forInCandidates({ ...input, seen: new Set() }));

export const canonicalValueEnumeratedForInSources = (
  input: IterationInput,
): readonly CanonicalValueCallArgumentSource[] =>
  distinctSources(enumeratedForInCandidates({ ...input, seen: new Set() }));

export const canonicalValueForOfCandidates = (
  input: IterationInput,
): readonly ESTree.Expression[] =>
  canonicalValueForOfSources(input).map((source) => source.expression);

export const canonicalValueForInCandidates = (
  input: IterationInput,
): readonly ESTree.Expression[] =>
  canonicalValueEnumeratedForInSources(input).map((source) => source.expression);
