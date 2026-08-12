import { describe, expect, test } from "vite-plus/test";

import { buildBodyIndex, duplicatedClustersIn } from "./body-index.ts";

const ENOUGH_NODES = 8;

const it = test
  .extend("sitesSharingAFingerprint", () => {
    const index = buildBodyIndex([
      {
        relativePath: "a.ts",
        bodies: [{ name: "declaration1", line: 1, fingerprint: "shared", nodeCount: ENOUGH_NODES }],
      },
      {
        relativePath: "b.ts",
        bodies: [{ name: "declaration2", line: 2, fingerprint: "shared", nodeCount: ENOUGH_NODES }],
      },
    ]);
    return index.sitesByFingerprint.get("shared");
  })
  .extend("bodiesOfAFileReachedByItsPath", () => {
    const index = buildBodyIndex([
      {
        relativePath: "a.ts",
        bodies: [{ name: "declaration1", line: 1, fingerprint: "alone", nodeCount: ENOUGH_NODES }],
      },
    ]);
    return index.bodiesByPath.get("a.ts");
  })
  .extend("sitesOfAClusterSpreadAcrossFilesAndLines", () => {
    const index = buildBodyIndex([
      {
        relativePath: "b.ts",
        bodies: [{ name: "declaration9", line: 9, fingerprint: "shared", nodeCount: ENOUGH_NODES }],
      },
      {
        relativePath: "a.ts",
        bodies: [
          { name: "declaration4", line: 4, fingerprint: "shared", nodeCount: ENOUGH_NODES },
          { name: "declaration1", line: 1, fingerprint: "shared", nodeCount: ENOUGH_NODES },
        ],
      },
    ]);
    return index.sitesByFingerprint.get("shared");
  })
  .extend("sitesOfAFingerprintCarriedOnlyByBodiesWithTooFewNodes", () => {
    const index = buildBodyIndex([
      {
        relativePath: "a.ts",
        bodies: [{ name: "declaration1", line: 1, fingerprint: "shared", nodeCount: 1 }],
      },
      {
        relativePath: "b.ts",
        bodies: [{ name: "declaration2", line: 2, fingerprint: "shared", nodeCount: 1 }],
      },
    ]);
    return index.sitesByFingerprint.get("shared");
  })
  .extend("bodiesOfAFileWhoseOnlyBodyHasTooFewNodes", () => {
    const index = buildBodyIndex([
      {
        relativePath: "a.ts",
        bodies: [{ name: "declaration1", line: 1, fingerprint: "shared", nodeCount: 1 }],
      },
    ]);
    return index.bodiesByPath.get("a.ts");
  })
  .extend("clustersOfAFingerprintOnlyOneDeclarationCarries", () => {
    const index = buildBodyIndex([
      {
        relativePath: "a.ts",
        bodies: [{ name: "declaration1", line: 1, fingerprint: "alone", nodeCount: ENOUGH_NODES }],
      },
    ]);
    return duplicatedClustersIn(index);
  })
  .extend("clustersOfFilesIndexedFromTheLaterFingerprint", () => {
    const index = buildBodyIndex([
      {
        relativePath: "z.ts",
        bodies: [{ name: "declaration1", line: 1, fingerprint: "later", nodeCount: ENOUGH_NODES }],
      },
      {
        relativePath: "y.ts",
        bodies: [{ name: "declaration2", line: 2, fingerprint: "later", nodeCount: ENOUGH_NODES }],
      },
      {
        relativePath: "a.ts",
        bodies: [
          { name: "declaration3", line: 3, fingerprint: "earlier", nodeCount: ENOUGH_NODES },
        ],
      },
      {
        relativePath: "b.ts",
        bodies: [
          { name: "declaration4", line: 4, fingerprint: "earlier", nodeCount: ENOUGH_NODES },
        ],
      },
    ]);
    return duplicatedClustersIn(index);
  })
  .extend("clustersOfTheSameFilesIndexedFromTheEarlierFingerprint", () => {
    const index = buildBodyIndex([
      {
        relativePath: "a.ts",
        bodies: [
          { name: "declaration3", line: 3, fingerprint: "earlier", nodeCount: ENOUGH_NODES },
        ],
      },
      {
        relativePath: "b.ts",
        bodies: [
          { name: "declaration4", line: 4, fingerprint: "earlier", nodeCount: ENOUGH_NODES },
        ],
      },
      {
        relativePath: "z.ts",
        bodies: [{ name: "declaration1", line: 1, fingerprint: "later", nodeCount: ENOUGH_NODES }],
      },
      {
        relativePath: "y.ts",
        bodies: [{ name: "declaration2", line: 2, fingerprint: "later", nodeCount: ENOUGH_NODES }],
      },
    ]);
    return duplicatedClustersIn(index);
  })
  .extend("clustersOfAFingerprintThreeDeclarationsCarry", () => {
    const index = buildBodyIndex([
      {
        relativePath: "a.ts",
        bodies: [{ name: "declaration1", line: 1, fingerprint: "shared", nodeCount: ENOUGH_NODES }],
      },
      {
        relativePath: "b.ts",
        bodies: [{ name: "declaration2", line: 2, fingerprint: "shared", nodeCount: ENOUGH_NODES }],
      },
      {
        relativePath: "c.ts",
        bodies: [{ name: "declaration3", line: 3, fingerprint: "shared", nodeCount: ENOUGH_NODES }],
      },
    ]);
    return duplicatedClustersIn(index);
  });

describe("buildBodyIndex", () => {
  it("gathers the sites that share a fingerprint", ({ sitesSharingAFingerprint }) => {
    expect(sitesSharingAFingerprint).toStrictEqual([
      { relativePath: "a.ts", name: "declaration1", line: 1 },
      { relativePath: "b.ts", name: "declaration2", line: 2 },
    ]);
  });

  it("keeps the declarations of a file reachable by its path", ({
    bodiesOfAFileReachedByItsPath,
  }) => {
    expect(bodiesOfAFileReachedByItsPath).toStrictEqual([
      { name: "declaration1", line: 1, fingerprint: "alone", nodeCount: ENOUGH_NODES },
    ]);
  });

  it("orders the sites of a cluster by path and line", ({
    sitesOfAClusterSpreadAcrossFilesAndLines,
  }) => {
    expect(sitesOfAClusterSpreadAcrossFilesAndLines).toStrictEqual([
      { relativePath: "a.ts", name: "declaration1", line: 1 },
      { relativePath: "a.ts", name: "declaration4", line: 4 },
      { relativePath: "b.ts", name: "declaration9", line: 9 },
    ]);
  });

  it("leaves a body with too few nodes out of the fingerprint route", ({
    sitesOfAFingerprintCarriedOnlyByBodiesWithTooFewNodes,
  }) => {
    expect(sitesOfAFingerprintCarriedOnlyByBodiesWithTooFewNodes).toBe(undefined);
  });

  it("keeps a body with too few nodes reachable by its path", ({
    bodiesOfAFileWhoseOnlyBodyHasTooFewNodes,
  }) => {
    expect(bodiesOfAFileWhoseOnlyBodyHasTooFewNodes).toStrictEqual([
      { name: "declaration1", line: 1, fingerprint: "shared", nodeCount: 1 },
    ]);
  });
});

describe("duplicatedClustersIn", () => {
  it("leaves out a fingerprint that only one declaration carries", ({
    clustersOfAFingerprintOnlyOneDeclarationCarries,
  }) => {
    expect(clustersOfAFingerprintOnlyOneDeclarationCarries).toStrictEqual([]);
  });

  it("orders the clusters by the site each of them starts at", ({
    clustersOfFilesIndexedFromTheLaterFingerprint,
  }) => {
    expect(clustersOfFilesIndexedFromTheLaterFingerprint).toStrictEqual([
      [
        { relativePath: "a.ts", name: "declaration3", line: 3 },
        { relativePath: "b.ts", name: "declaration4", line: 4 },
      ],
      [
        { relativePath: "y.ts", name: "declaration2", line: 2 },
        { relativePath: "z.ts", name: "declaration1", line: 1 },
      ],
    ]);
  });

  it("the ordering does not depend on the order the files were indexed in", ({
    clustersOfTheSameFilesIndexedFromTheEarlierFingerprint,
  }) => {
    expect(clustersOfTheSameFilesIndexedFromTheEarlierFingerprint).toStrictEqual([
      [
        { relativePath: "a.ts", name: "declaration3", line: 3 },
        { relativePath: "b.ts", name: "declaration4", line: 4 },
      ],
      [
        { relativePath: "y.ts", name: "declaration2", line: 2 },
        { relativePath: "z.ts", name: "declaration1", line: 1 },
      ],
    ]);
  });

  it("reports a cluster once, with every site in it", ({
    clustersOfAFingerprintThreeDeclarationsCarry,
  }) => {
    expect(clustersOfAFingerprintThreeDeclarationsCarry).toStrictEqual([
      [
        { relativePath: "a.ts", name: "declaration1", line: 1 },
        { relativePath: "b.ts", name: "declaration2", line: 2 },
        { relativePath: "c.ts", name: "declaration3", line: 3 },
      ],
    ]);
  });
});
