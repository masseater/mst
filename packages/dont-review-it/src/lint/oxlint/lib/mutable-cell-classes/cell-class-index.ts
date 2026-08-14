import type { ConstructionSite, DeclaredClass, SourceFacts } from "./construction-sites.ts";

export type CellClassFinding = {
  readonly className: string;
  readonly fields: readonly string[];
  readonly scopeName: string | null;
};

export type CellClassIndex = {
  readonly findingsByPath: ReadonlyMap<string, readonly CellClassFinding[]>;
};

export type CellClassIndexLoader = (options: { readonly repositoryRoot: string }) => CellClassIndex;

export const EMPTY_CELL_CLASS_INDEX: CellClassIndex = { findingsByPath: new Map() };

export type ScannedSource = {
  readonly relativePath: string;
  readonly facts: SourceFacts;
};

const namesConstructedElsewhere = (sources: readonly ScannedSource[]): ReadonlySet<string> =>
  new Set(
    sources.flatMap(({ facts }) => {
      const declaredHere = new Set(facts.declaredClasses.map((declared) => declared.name));
      return facts.constructions
        .filter((site) => !declaredHere.has(site.name))
        .map((site) => site.name);
    }),
  );

const isContainedInOneScope = (sites: readonly ConstructionSite[]): boolean => {
  if (sites.length === 0) return false;
  if (sites.some((site) => site.scopeKey === null || site.escapes)) return false;
  return new Set(sites.map((site) => site.scopeKey)).size === 1;
};

const findingFor = ({
  declared,
  facts,
  reachedElsewhere,
}: {
  readonly declared: DeclaredClass;
  readonly facts: SourceFacts;
  readonly reachedElsewhere: ReadonlySet<string>;
}): CellClassFinding | null => {
  if (declared.fields.length === 0) return null;
  if (declared.shared) return null;
  if (facts.divertedNames.has(declared.name)) return null;
  if (reachedElsewhere.has(declared.name)) return null;

  const sites = facts.constructions.filter((site) => site.name === declared.name);
  if (!isContainedInOneScope(sites)) return null;

  return {
    className: declared.name,
    fields: declared.fields,
    scopeName: sites.map((site) => site.scopeName).find((spelled) => spelled !== null) ?? null,
  };
};

export const buildCellClassIndex = (sources: readonly ScannedSource[]): CellClassIndex => {
  const reachedElsewhere = namesConstructedElsewhere(sources);

  return {
    findingsByPath: new Map(
      sources.map(({ relativePath, facts }) => [
        relativePath,
        facts.declaredClasses.flatMap((declared) => {
          const finding = findingFor({ declared, facts, reachedElsewhere });
          return finding === null ? [] : [finding];
        }),
      ]),
    ),
  };
};
