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

const carriesEnoughNodes = (body: { readonly nodeCount: number }): boolean =>
  body.nodeCount >= MINIMUM_BODY_NODES;

export const namedFingerprintOf = (body: {
  readonly name: string;
  readonly fingerprint: string;
}): string => JSON.stringify([body.name, body.fingerprint]);

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
  bodies: readonly PlacedBody[],
  keyOf: (body: PlacedBody) => string,
): ReadonlyMap<string, readonly BodySite[]> =>
  new Map(
    Object.entries(groupBy(bodies, keyOf)).map(([key, grouped]) => [
      key,
      grouped.map(siteOf).toSorted(bySiteOrder),
    ]),
  );

export const buildBodyIndex = (files: readonly IndexedFile[]): BodyIndex => {
  const placed: readonly PlacedBody[] = files.flatMap((file) =>
    file.bodies.map((body) => ({ ...body, relativePath: file.relativePath })),
  );

  return {
    sitesByFingerprint: sitesByKey(placed.filter(carriesEnoughNodes), (body) => body.fingerprint),
    sitesByNamedFingerprint: sitesByKey(placed, namedFingerprintOf),
    bodiesByPath: new Map(files.map((file) => [file.relativePath, file.bodies])),
  };
};

const clustersIn = (
  sitesByKey: ReadonlyMap<string, readonly BodySite[]>,
): readonly (readonly BodySite[])[] =>
  [...sitesByKey.values()]
    .filter((sites) => sites.length > 1)
    .toSorted((left, right) => {
      const [leftFirst] = left;
      const [rightFirst] = right;
      if (leftFirst === undefined || rightFirst === undefined) return 0;
      return bySiteOrder(leftFirst, rightFirst);
    });

export const duplicatedClustersIn = (index: BodyIndex): readonly (readonly BodySite[])[] =>
  clustersIn(index.sitesByFingerprint);
