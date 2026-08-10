import { describe, expect, test } from "vite-plus/test";

import { buildBodyIndex, duplicatedClustersIn } from "./body-index.ts";

const indexedBodyAt = (line: number, fingerprint: string) => ({
  name: `declaration${line}`,
  line,
  fingerprint,
});

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
    expect(index.sitesByFingerprint.get("shared")?.map((site) => site.line)).toStrictEqual([
      1, 4, 9,
    ]);
  });
});

describe("duplicatedClustersIn", () => {
  test("leaves out a fingerprint that only one declaration carries", () => {
    const index = buildBodyIndex([{ relativePath: "a.ts", bodies: [indexedBodyAt(1, "alone")] }]);
    expect(duplicatedClustersIn(index)).toStrictEqual([]);
  });

  test("orders the clusters by the site each of them starts at", () => {
    const index = buildBodyIndex([
      { relativePath: "z.ts", bodies: [indexedBodyAt(1, "later")] },
      { relativePath: "y.ts", bodies: [indexedBodyAt(2, "later")] },
      { relativePath: "a.ts", bodies: [indexedBodyAt(3, "earlier")] },
      { relativePath: "b.ts", bodies: [indexedBodyAt(4, "earlier")] },
    ]);

    expect(duplicatedClustersIn(index).map((cluster) => cluster[0].relativePath)).toStrictEqual([
      "a.ts",
      "y.ts",
    ]);
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
