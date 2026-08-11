import { groupBy, sortBy } from "es-toolkit";

import type { ValueDeclaration } from "./declarations.ts";

export type ValueSite = ValueDeclaration & { readonly relativePath: string };

export type ValueDeclarationIndex = {
  readonly sitesByName: ReadonlyMap<string, readonly ValueSite[]>;
  readonly sitesByPath: ReadonlyMap<string, readonly ValueSite[]>;
};

export type ValueDeclarationIndexLoader = (options: {
  readonly repositoryRoot: string;
}) => ValueDeclarationIndex;

export type IndexedValueFile = {
  readonly relativePath: string;
  readonly declarations: readonly ValueDeclaration[];
};

const placedSitesIn = (files: readonly IndexedValueFile[]): readonly ValueSite[] =>
  files.flatMap((file) =>
    file.declarations.map((declaration) => ({ ...declaration, relativePath: file.relativePath })),
  );

const gatheredBy = (
  sites: readonly ValueSite[],
  keyOf: (site: ValueSite) => string,
): ReadonlyMap<string, readonly ValueSite[]> =>
  new Map(
    Object.entries(groupBy(sites, keyOf)).map(([key, gathered]) => [
      key,
      sortBy(gathered, ["relativePath", "line"]),
    ]),
  );

export const buildValueDeclarationIndex = (
  files: readonly IndexedValueFile[],
): ValueDeclarationIndex => {
  const sites = placedSitesIn(files);

  return {
    sitesByName: gatheredBy(sites, (site) => site.name),
    sitesByPath: gatheredBy(sites, (site) => site.relativePath),
  };
};

const standsElsewhere = (site: ValueSite, other: ValueSite): boolean =>
  other.relativePath !== site.relativePath || other.line !== site.line;

const rivalsOf = (index: ValueDeclarationIndex, site: ValueSite): readonly ValueSite[] =>
  (index.sitesByName.get(site.name) ?? []).filter(
    (other) =>
      other.fingerprint === site.fingerprint &&
      standsElsewhere(site, other) &&
      (other.exported || site.exported),
  );

export const duplicateValueReportsIn = (input: {
  readonly index: ValueDeclarationIndex;
  readonly relativePath: string;
}): readonly { readonly site: ValueSite; readonly matches: readonly ValueSite[] }[] =>
  (input.index.sitesByPath.get(input.relativePath) ?? []).flatMap((site) => {
    const matches = rivalsOf(input.index, site);
    return matches.length === 0 ? [] : [{ site, matches }];
  });
