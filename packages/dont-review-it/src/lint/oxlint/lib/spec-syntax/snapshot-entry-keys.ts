import { groupBy, zip } from "es-toolkit";

import { isFunctionNodeType } from "../node-kinds.ts";
import { isAssertionChain } from "./assertion-entries.ts";
import { SNAPSHOT_MATCHERS } from "./matcher-vocabulary.ts";
import { externalRecordKeyOf } from "./snapshot-records.ts";
import { staticMemberName, staticSpelling } from "./static-names.ts";
import { asSpecFunction, unwrapSubject } from "./subject-expressions.ts";
import {
  TABLE_DRIVEN_MEMBERS,
  tableDrivenTitlesOf,
  type TableDrivenTitles,
} from "./table-driven-titles.ts";

import type { ESTree } from "@oxlint/plugins";

export const INLINE_SPELLING_BY_EXTERNAL: ReadonlyMap<string, string> = new Map([
  ["matchSnapshot", "toMatchInlineSnapshot"],
  ["toMatchSnapshot", "toMatchInlineSnapshot"],
  ["toThrowErrorMatchingSnapshot", "toThrowErrorMatchingInlineSnapshot"],
]);

export type SnapshotEntryKeys =
  | { readonly kind: "spelled"; readonly keys: readonly string[] }
  | { readonly kind: "unresolvable" }
  | { readonly kind: "unreadable" };

export type SnapshotMatcherSite = {
  readonly node: ESTree.CallExpression;
  readonly matcher: string;
  readonly matcherNode: ESTree.Node;
  readonly hintNode: ESTree.Expression | null;
  readonly hintText: string | null;
  readonly hintRuntime: boolean;
  readonly scopes: readonly TableDrivenTitles[];
  readonly orderBroken: boolean;
};

const ORDER_BREAKING_TYPES: ReadonlySet<string> = new Set([
  "ConditionalExpression",
  "DoWhileStatement",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "IfStatement",
  "LogicalExpression",
  "SwitchStatement",
  "WhileStatement",
]);

const tableOf = (callee: ESTree.Expression): ESTree.Expression | null => {
  const written = unwrapSubject(callee);
  if (written.type !== "CallExpression") return null;

  const builder = unwrapSubject(written.callee);
  if (builder.type !== "MemberExpression") return null;

  const member = staticMemberName(builder);
  if (member === null || !TABLE_DRIVEN_MEMBERS.has(member)) return null;

  const [table] = written.arguments;
  return table === undefined || table.type === "SpreadElement" ? null : table;
};

const isTaggedTable = (callee: ESTree.Expression): boolean => {
  const written = unwrapSubject(callee);
  if (written.type !== "TaggedTemplateExpression") return false;

  const tag = unwrapSubject(written.tag);
  if (tag.type !== "MemberExpression") return false;

  const member = staticMemberName(tag);
  return member !== null && TABLE_DRIVEN_MEMBERS.has(member);
};

const titledCallShape = (call: ESTree.CallExpression): ESTree.Expression | null => {
  const [first, ...trailing] = call.arguments;
  const last = trailing.at(-1);
  if (first === undefined || last === undefined) return null;
  if (first.type === "SpreadElement" || last.type === "SpreadElement") return null;
  return asSpecFunction(last) === null ? null : first;
};

const titleScopeOf = (call: ESTree.CallExpression): TableDrivenTitles | null => {
  const titled = titledCallShape(call);
  if (titled === null) return null;
  if (isTaggedTable(call.callee)) return { kind: "unreadable" };

  const template = staticSpelling(titled);
  if (template === null) return { kind: "runtime" };

  const table = tableOf(call.callee);
  return table === null
    ? { kind: "spelled", titles: [template] }
    : tableDrivenTitlesOf(table, template);
};

const hintOf = (
  call: ESTree.CallExpression,
  matcher: string,
): Pick<SnapshotMatcherSite, "hintNode" | "hintText" | "hintRuntime"> => {
  const bare = { hintNode: null, hintText: null, hintRuntime: false };
  if (!INLINE_SPELLING_BY_EXTERNAL.has(matcher)) return bare;

  const given = call.arguments.flatMap((argument) =>
    argument.type === "SpreadElement" ? [] : [argument],
  );
  if (given.length !== call.arguments.length) return { ...bare, hintRuntime: true };

  const last = given.at(-1);
  if (last === undefined) return bare;

  const spelled = staticSpelling(last);
  if (spelled !== null) return { hintNode: last, hintText: spelled, hintRuntime: false };
  if (given.length === 1 && unwrapSubject(last).type === "ObjectExpression") return bare;
  return { ...bare, hintRuntime: true };
};

const isTitleScope = (node: ESTree.Node): boolean =>
  node.type === "CallExpression" && titleScopeOf(node) !== null;

const scopesIn = (ancestors: readonly ESTree.Node[]): readonly TableDrivenTitles[] =>
  ancestors.flatMap((ancestor) =>
    ancestor.type === "CallExpression" ? (titleScopeOf(ancestor) ?? []) : [],
  );

const breaksOrder = (ancestors: readonly ESTree.Node[]): boolean => {
  const scopeAt = ancestors.findLastIndex(isTitleScope);
  if (scopeAt < 0) return false;

  const inside = ancestors.slice(scopeAt + 1);
  const [head] = inside;
  const scopeNodes = head !== undefined && isFunctionNodeType(head.type) ? inside.slice(1) : inside;
  return scopeNodes.some(
    (node) => isFunctionNodeType(node.type) || ORDER_BREAKING_TYPES.has(node.type),
  );
};

export const snapshotMatcherSiteOf = (
  call: ESTree.CallExpression,
  ancestors: readonly ESTree.Node[],
): SnapshotMatcherSite | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const matcher = staticMemberName(callee);
  if (matcher === null || !SNAPSHOT_MATCHERS.has(matcher)) return null;
  if (!isAssertionChain(callee.object)) return null;

  return {
    node: call,
    matcher,
    matcherNode: callee.property,
    ...hintOf(call, matcher),
    scopes: scopesIn(ancestors),
    orderBroken: breaksOrder(ancestors),
  };
};

type Placement = {
  readonly site: SnapshotMatcherSite;
  readonly titles: readonly string[];
  readonly order: readonly number[];
};

type Combination = {
  readonly titles: readonly string[];
  readonly order: readonly number[];
};

const extendedBy = (prefix: Combination, titles: readonly string[]): readonly Combination[] =>
  titles.map((title, index) => ({
    titles: [...prefix.titles, title],
    order: [...prefix.order, index],
  }));

const combinationsOf = (titlesByScope: readonly (readonly string[])[]): readonly Combination[] =>
  titlesByScope.reduce<readonly Combination[]>(
    (carried, titles) => carried.flatMap((prefix) => extendedBy(prefix, titles)),
    [{ titles: [], order: [] }],
  );

const placementsOf = (site: SnapshotMatcherSite): readonly Placement[] => {
  const spelled = site.scopes.flatMap((scope) => (scope.kind === "spelled" ? [scope.titles] : []));
  if (spelled.length !== site.scopes.length) return [];

  return combinationsOf(spelled).map((combination) => ({
    site,
    titles: combination.titles,
    order: [...combination.order, site.node.start],
  }));
};

const byExecutionOrder = (left: Placement, right: Placement): number =>
  zip(left.order, right.order).reduce(
    (carried, [taken, rival]) => (carried === 0 ? taken - rival : carried),
    0,
  );

const bucketKeyOf = (titles: readonly string[]): string => JSON.stringify(titles);

const bucketedPlacements = (
  sites: readonly SnapshotMatcherSite[],
): ReadonlyMap<string, readonly Placement[]> =>
  new Map(
    Object.entries(
      groupBy(sites.flatMap(placementsOf), (placement) => bucketKeyOf(placement.titles)),
    ),
  );

type Ordinals = Map<string, number>;

const takeOrdinal = (ordinals: Ordinals, bucket: string): number => {
  const ordinal = (ordinals.get(bucket) ?? 0) + 1;
  ordinals.set(bucket, ordinal);
  return ordinal;
};

const keyedTitlesOf = (placement: Placement): readonly string[] =>
  placement.site.hintText === null
    ? placement.titles
    : [...placement.titles, placement.site.hintText];

type SpelledKeys = Map<SnapshotMatcherSite, readonly string[]>;

const bucketKeysIn = ({
  placements,
  ordinals,
  spelled,
}: {
  readonly placements: readonly Placement[];
  readonly ordinals: Ordinals;
  readonly spelled: SpelledKeys;
}): void => {
  const ordered = placements.toSorted(byExecutionOrder);
  const brokenAt = ordered.findIndex((placement) => placement.site.orderBroken);

  for (const [position, placement] of ordered.entries()) {
    const titles = keyedTitlesOf(placement);
    const ordinal = takeOrdinal(ordinals, bucketKeyOf(titles));
    if (brokenAt >= 0 && position >= brokenAt) continue;

    spelled.set(placement.site, [
      ...(spelled.get(placement.site) ?? []),
      externalRecordKeyOf(titles, ordinal),
    ]);
  }
};

const spelledKeysBySite = (
  sites: readonly SnapshotMatcherSite[],
): ReadonlyMap<SnapshotMatcherSite, readonly string[]> => {
  const ordinals: Ordinals = new Map();
  const spelled: SpelledKeys = new Map();

  for (const placements of bucketedPlacements(sites).values()) {
    bucketKeysIn({ placements, ordinals, spelled });
  }
  return spelled;
};

export const entryKeysOf = (
  sites: readonly SnapshotMatcherSite[],
): readonly SnapshotEntryKeys[] => {
  const spelled = spelledKeysBySite(sites);

  return sites.map((site) => {
    if (site.hintRuntime) return { kind: "unresolvable" };
    if (site.scopes.length === 0) return { kind: "unreadable" };
    if (site.scopes.some((scope) => scope.kind === "runtime")) return { kind: "unresolvable" };
    if (site.scopes.some((scope) => scope.kind === "unreadable")) return { kind: "unreadable" };

    const snapshotKeys = spelled.get(site) ?? [];
    return snapshotKeys.length === placementsOf(site).length
      ? { kind: "spelled", keys: snapshotKeys }
      : { kind: "unresolvable" };
  });
};
