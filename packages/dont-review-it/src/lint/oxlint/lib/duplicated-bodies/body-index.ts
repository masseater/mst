import { groupBy } from "es-toolkit";

export type BodySite = {
  readonly relativePath: string;
  readonly name: string;
  readonly line: number;
};

type IndexedBody = {
  readonly name: string;
  readonly line: number;
  readonly fingerprint: string;
  readonly nodeCount: number;
};

export type BodyIndex = {
  readonly sitesByFingerprint: ReadonlyMap<string, readonly BodySite[]>;
  readonly sitesByNamedFingerprint: ReadonlyMap<string, readonly BodySite[]>;
  readonly bodiesByPath: ReadonlyMap<string, readonly IndexedBody[]>;
};

export type BodyIndexLoader = (options: { readonly repositoryRoot: string }) => BodyIndex;

export const EMPTY_BODY_INDEX: BodyIndex = {
  sitesByFingerprint: new Map(),
  sitesByNamedFingerprint: new Map(),
  bodiesByPath: new Map(),
};

const MINIMUM_BODY_NODES = 8;

const carriesEnoughNodes = (writtenBody: { readonly nodeCount: number }): boolean =>
  writtenBody.nodeCount >= MINIMUM_BODY_NODES;

export const namedFingerprintOf = (writtenBody: {
  readonly name: string;
  readonly fingerprint: string;
}): string => JSON.stringify([writtenBody.name, writtenBody.fingerprint]);

export type IndexedFile = {
  readonly relativePath: string;
  readonly bodies: readonly IndexedBody[];
};

type PlacedBody = IndexedBody & { readonly relativePath: string };

const bySiteOrder = (left: BodySite, right: BodySite): number => {
  if (left.relativePath !== right.relativePath) {
    return left.relativePath < right.relativePath ? -1 : 1;
  }
  return left.line - right.line;
};

const siteOf = ({ relativePath, name, line }: PlacedBody): BodySite => ({
  relativePath,
  name,
  line,
});

const sitesByKey = (
  writtenBodies: readonly PlacedBody[],
  keyOf: (body: PlacedBody) => string,
): ReadonlyMap<string, readonly BodySite[]> =>
  new Map(
    Object.entries(groupBy(writtenBodies, keyOf)).map(([named, grouped]) => [
      named,
      grouped.map(siteOf).toSorted(bySiteOrder),
    ]),
  );

export const buildBodyIndex = (files: readonly IndexedFile[]): BodyIndex => {
  const placed: readonly PlacedBody[] = files.flatMap((file) =>
    file.bodies.map((writtenBody) => ({ ...writtenBody, relativePath: file.relativePath })),
  );

  return {
    sitesByFingerprint: sitesByKey(
      placed.filter(carriesEnoughNodes),
      (writtenBody) => writtenBody.fingerprint,
    ),
    sitesByNamedFingerprint: sitesByKey(placed, namedFingerprintOf),
    bodiesByPath: new Map(files.map((file) => [file.relativePath, file.bodies])),
  };
};

const LINE_ORDER_WIDTH = 12;

const firstSiteKey = (sites: readonly BodySite[]): string =>
  sites
    .slice(0, 1)
    .map((site) => `${site.relativePath}\0${String(site.line).padStart(LINE_ORDER_WIDTH, "0")}`)
    .join("");

const clustersIn = (
  sitesByKey: ReadonlyMap<string, readonly BodySite[]>,
): readonly (readonly BodySite[])[] =>
  [...sitesByKey.values()]
    .filter((sites) => sites.length > 1)
    .toSorted((left, right) => (firstSiteKey(left) < firstSiteKey(right) ? -1 : 1));

export const duplicatedClustersIn = (index: BodyIndex): readonly (readonly BodySite[])[] =>
  clustersIn(index.sitesByFingerprint);
