import { describe, expect, test } from "vite-plus/test";

import { buildBodyIndex, duplicatedClustersIn } from "./body-index.ts";

const ENOUGH_NODES = 8;

describe("buildBodyIndex", () => {
  describe("two files declaring a body under the same fingerprint", () => {
    const it = test.extend("sites", () =>
      buildBodyIndex([
        {
          relativePath: "a.ts",
          bodies: [
            { name: "declaration1", line: 1, fingerprint: "shared", nodeCount: ENOUGH_NODES },
          ],
        },
        {
          relativePath: "b.ts",
          bodies: [
            { name: "declaration2", line: 2, fingerprint: "shared", nodeCount: ENOUGH_NODES },
          ],
        },
      ]).sitesByFingerprint.get("shared"));

    it("are gathered as the sites that fingerprint reaches", ({ sites }) => {
      expect(sites).toStrictEqual([
        { relativePath: "a.ts", name: "declaration1", line: 1 },
        { relativePath: "b.ts", name: "declaration2", line: 2 },
      ]);
    });
  });

  describe("a file declaring one body", () => {
    const it = test.extend("bodies", () =>
      buildBodyIndex([
        {
          relativePath: "a.ts",
          bodies: [
            { name: "declaration1", line: 1, fingerprint: "alone", nodeCount: ENOUGH_NODES },
          ],
        },
      ]).bodiesByPath.get("a.ts"));

    it("keeps that declaration reachable by the path of the file", ({ bodies }) => {
      expect(bodies).toStrictEqual([
        { name: "declaration1", line: 1, fingerprint: "alone", nodeCount: ENOUGH_NODES },
      ]);
    });
  });

  describe("bodies sharing a fingerprint across several files and lines", () => {
    const it = test.extend("sites", () =>
      buildBodyIndex([
        {
          relativePath: "b.ts",
          bodies: [
            { name: "declaration9", line: 9, fingerprint: "shared", nodeCount: ENOUGH_NODES },
          ],
        },
        {
          relativePath: "a.ts",
          bodies: [
            { name: "declaration4", line: 4, fingerprint: "shared", nodeCount: ENOUGH_NODES },
            { name: "declaration1", line: 1, fingerprint: "shared", nodeCount: ENOUGH_NODES },
          ],
        },
      ]).sitesByFingerprint.get("shared"));

    it("are ordered by path and then by line", ({ sites }) => {
      expect(sites).toStrictEqual([
        { relativePath: "a.ts", name: "declaration1", line: 1 },
        { relativePath: "a.ts", name: "declaration4", line: 4 },
        { relativePath: "b.ts", name: "declaration9", line: 9 },
      ]);
    });
  });

  describe("a fingerprint carried only by bodies with too few nodes", () => {
    const it = test.extend("sites", () =>
      buildBodyIndex([
        {
          relativePath: "a.ts",
          bodies: [{ name: "declaration1", line: 1, fingerprint: "shared", nodeCount: 1 }],
        },
        {
          relativePath: "b.ts",
          bodies: [{ name: "declaration2", line: 2, fingerprint: "shared", nodeCount: 1 }],
        },
      ]).sitesByFingerprint.get("shared"));

    it("reaches no site at all", ({ sites }) => {
      expect(sites).toBe(undefined);
    });
  });

  describe("a file whose only body has too few nodes", () => {
    const it = test.extend("bodies", () =>
      buildBodyIndex([
        {
          relativePath: "a.ts",
          bodies: [{ name: "declaration1", line: 1, fingerprint: "shared", nodeCount: 1 }],
        },
      ]).bodiesByPath.get("a.ts"));

    it("keeps that body reachable by the path of the file", ({ bodies }) => {
      expect(bodies).toStrictEqual([
        { name: "declaration1", line: 1, fingerprint: "shared", nodeCount: 1 },
      ]);
    });
  });
});

describe("duplicatedClustersIn", () => {
  describe("a fingerprint only one declaration carries", () => {
    const it = test.extend("clusters", () =>
      duplicatedClustersIn(
        buildBodyIndex([
          {
            relativePath: "a.ts",
            bodies: [
              { name: "declaration1", line: 1, fingerprint: "alone", nodeCount: ENOUGH_NODES },
            ],
          },
        ]),
      ));

    it("is left out of the clusters", ({ clusters }) => {
      expect(clusters).toStrictEqual([]);
    });
  });

  describe("two fingerprints whose files were indexed from the later one", () => {
    const it = test.extend("clusters", () =>
      duplicatedClustersIn(
        buildBodyIndex([
          {
            relativePath: "z.ts",
            bodies: [
              { name: "declaration1", line: 1, fingerprint: "later", nodeCount: ENOUGH_NODES },
            ],
          },
          {
            relativePath: "y.ts",
            bodies: [
              { name: "declaration2", line: 2, fingerprint: "later", nodeCount: ENOUGH_NODES },
            ],
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
        ]),
      ));

    it("come back ordered by the site each cluster starts at", ({ clusters }) => {
      expect(clusters).toStrictEqual([
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
  });

  describe("the same two fingerprints whose files were indexed from the earlier one", () => {
    const it = test.extend("clusters", () =>
      duplicatedClustersIn(
        buildBodyIndex([
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
            bodies: [
              { name: "declaration1", line: 1, fingerprint: "later", nodeCount: ENOUGH_NODES },
            ],
          },
          {
            relativePath: "y.ts",
            bodies: [
              { name: "declaration2", line: 2, fingerprint: "later", nodeCount: ENOUGH_NODES },
            ],
          },
        ]),
      ));

    it("come back in that same order", ({ clusters }) => {
      expect(clusters).toStrictEqual([
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
  });

  describe("a fingerprint three declarations carry", () => {
    const it = test.extend("clusters", () =>
      duplicatedClustersIn(
        buildBodyIndex([
          {
            relativePath: "a.ts",
            bodies: [
              { name: "declaration1", line: 1, fingerprint: "shared", nodeCount: ENOUGH_NODES },
            ],
          },
          {
            relativePath: "b.ts",
            bodies: [
              { name: "declaration2", line: 2, fingerprint: "shared", nodeCount: ENOUGH_NODES },
            ],
          },
          {
            relativePath: "c.ts",
            bodies: [
              { name: "declaration3", line: 3, fingerprint: "shared", nodeCount: ENOUGH_NODES },
            ],
          },
        ]),
      ));

    it("comes back once, carrying every site of it", ({ clusters }) => {
      expect(clusters).toStrictEqual([
        [
          { relativePath: "a.ts", name: "declaration1", line: 1 },
          { relativePath: "b.ts", name: "declaration2", line: 2 },
          { relativePath: "c.ts", name: "declaration3", line: 3 },
        ],
      ]);
    });
  });
});
