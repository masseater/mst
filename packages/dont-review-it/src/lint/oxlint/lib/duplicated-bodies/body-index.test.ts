import { describe, expect, test } from "vite-plus/test";

import { buildBodyIndex, duplicatedClustersIn, twinClustersIn } from "./body-index.ts";

const ENOUGH_NODES = 8;

const indexedBodyAt = (line: number, fingerprint: string) => ({
  name: `declaration${line}`,
  line,
  fingerprint,
  nodeCount: ENOUGH_NODES,
});

const linesOf = (sites: readonly { readonly line: number }[] | undefined): readonly number[] =>
  (sites ?? []).map((site) => site.line);

describe("buildBodyIndex", () => {
  test("gathers the sites that share a fingerprint", () => {
    const index = buildBodyIndex([
      { relativePath: "a.ts", bodies: [indexedBodyAt(1, "shared")] },
      { relativePath: "b.ts", bodies: [indexedBodyAt(2, "shared")] },
    ]);
    expect(index.sitesByFingerprint.get("shared")).toHaveLength(2);
  });

  test("keeps the declarations of a file reachable by its path", () => {
    const index = buildBodyIndex([{ relativePath: "a.ts", bodies: [indexedBodyAt(1, "alone")] }]);
    expect(index.bodiesByPath.get("a.ts")).toHaveLength(1);
  });

  test("orders the sites of a cluster by path and line", () => {
    const index = buildBodyIndex([
      { relativePath: "b.ts", bodies: [indexedBodyAt(9, "shared")] },
      { relativePath: "a.ts", bodies: [indexedBodyAt(4, "shared"), indexedBodyAt(1, "shared")] },
    ]);
    expect(linesOf(index.sitesByFingerprint.get("shared"))).toStrictEqual([1, 4, 9]);
  });

  test("leaves a body with too few nodes out of the fingerprint route", () => {
    const index = buildBodyIndex([
      { relativePath: "a.ts", bodies: [{ ...indexedBodyAt(1, "shared"), nodeCount: 1 }] },
      { relativePath: "b.ts", bodies: [{ ...indexedBodyAt(2, "shared"), nodeCount: 1 }] },
    ]);
    expect(index.sitesByFingerprint.get("shared")).toBeUndefined();
  });

  test("keeps a body with too few nodes reachable by its path", () => {
    const index = buildBodyIndex([
      { relativePath: "a.ts", bodies: [{ ...indexedBodyAt(1, "shared"), nodeCount: 1 }] },
    ]);
    expect(index.bodiesByPath.get("a.ts")).toHaveLength(1);
  });
});

describe("duplicatedClustersIn", () => {
  test("leaves out a fingerprint that only one declaration carries", () => {
    const index = buildBodyIndex([{ relativePath: "a.ts", bodies: [indexedBodyAt(1, "alone")] }]);
    expect(duplicatedClustersIn(index)).toStrictEqual([]);
  });

  test("reports a cluster once, with every site in it", () => {
    const index = buildBodyIndex([
      { relativePath: "a.ts", bodies: [indexedBodyAt(1, "shared")] },
      { relativePath: "b.ts", bodies: [indexedBodyAt(2, "shared")] },
      { relativePath: "c.ts", bodies: [indexedBodyAt(3, "shared")] },
    ]);
    const clusters = duplicatedClustersIn(index);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });
});

describe("twinClustersIn", () => {
  test("gathers two declarations that share both a name and a fingerprint", () => {
    const index = buildBodyIndex([
      {
        relativePath: "a.ts",
        bodies: [{ name: "LIMIT", line: 1, fingerprint: "two", nodeCount: 1 }],
      },
      {
        relativePath: "b.ts",
        bodies: [{ name: "LIMIT", line: 2, fingerprint: "two", nodeCount: 1 }],
      },
    ]);
    expect(twinClustersIn(index)).toHaveLength(1);
  });

  test("leaves two declarations apart when only the fingerprint matches", () => {
    const index = buildBodyIndex([
      {
        relativePath: "a.ts",
        bodies: [{ name: "LIMIT", line: 1, fingerprint: "two", nodeCount: 1 }],
      },
      {
        relativePath: "b.ts",
        bodies: [{ name: "DEPTH", line: 2, fingerprint: "two", nodeCount: 1 }],
      },
    ]);
    expect(twinClustersIn(index)).toStrictEqual([]);
  });

  test("leaves two declarations apart when only the name matches", () => {
    const index = buildBodyIndex([
      {
        relativePath: "a.ts",
        bodies: [{ name: "LIMIT", line: 1, fingerprint: "two", nodeCount: 1 }],
      },
      {
        relativePath: "b.ts",
        bodies: [{ name: "LIMIT", line: 2, fingerprint: "three", nodeCount: 1 }],
      },
    ]);
    expect(twinClustersIn(index)).toStrictEqual([]);
  });
});
