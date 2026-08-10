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
};

export type BodyIndex = {
  readonly sitesByFingerprint: ReadonlyMap<string, readonly BodySite[]>;
  readonly bodiesByPath: ReadonlyMap<string, readonly IndexedBody[]>;
};

export const EMPTY_BODY_INDEX: BodyIndex = {
  sitesByFingerprint: new Map(),
  bodiesByPath: new Map(),
};

export const MINIMUM_BODY_NODES = 8;

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

export const buildBodyIndex = (files: readonly IndexedFile[]): BodyIndex => {
  const placed: readonly PlacedBody[] = files.flatMap((file) =>
    file.bodies.map((body) => ({ ...body, relativePath: file.relativePath })),
  );

  const grouped = groupBy(placed, (body) => body.fingerprint);
  const sitesByFingerprint = new Map(
    Object.entries(grouped).map(([fingerprint, bodies]) => [
      fingerprint,
      bodies.map(siteOf).toSorted(bySiteOrder),
    ]),
  );

  const bodiesByPath = new Map(files.map((file) => [file.relativePath, file.bodies]));

  return { sitesByFingerprint, bodiesByPath };
};

export const duplicatedClustersIn = (index: BodyIndex): readonly (readonly BodySite[])[] =>
  [...index.sitesByFingerprint.values()]
    .filter((sites) => sites.length > 1)
    .toSorted((left, right) => bySiteOrder(left[0], right[0]));
