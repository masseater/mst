import { describe, expect, test } from "vite-plus/test";

import {
  buildTypeAuthorityIndex,
  carriesNonTrivialStructure,
  workspaceNameKeyOf,
} from "./authority-index.ts";
import { typeDeclarationsIn } from "./type-declarations.ts";

const WORKSPACE = "packages/order";

const THREE_NAMED_MEMBERS =
  "export type Shape = { readonly a: string; readonly b: number; readonly c: Named };";

const SPLIT_INTERFACE =
  "export interface Shape { readonly a: string }\nexport interface Shape { readonly b: Named }\n";

const WHOLE_INTERFACE = "export interface Shape { readonly a: string; readonly b: Named }\n";

describe("buildTypeAuthorityIndex", () => {
  describe("two scanned files", () => {
    const it = test.extend("indexedPaths", () =>
      Array.from(
        buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/a.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(THREE_NAMED_MEMBERS),
          },
          {
            relativePath: "packages/order/src/b.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(THREE_NAMED_MEMBERS),
          },
        ]).typesByPath.keys(),
      ));

    it("are each reachable by the path they were scanned at", ({ indexedPaths }) => {
      expect(indexedPaths).toStrictEqual(["packages/order/src/a.ts", "packages/order/src/b.ts"]);
    });
  });

  describe("a file declaring one interface name twice", () => {
    const it = test
      .extend("typeNames", () =>
        buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/a.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(SPLIT_INTERFACE),
          },
        ])
          .typesByPath.get("packages/order/src/a.ts")
          ?.map((indexed) => indexed.name))
      .extend("lines", () =>
        buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/a.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(SPLIT_INTERFACE),
          },
        ])
          .typesByPath.get("packages/order/src/a.ts")
          ?.map((indexed) => indexed.line),
      )
      .extend("memberCounts", () =>
        buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/a.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(SPLIT_INTERFACE),
          },
        ])
          .typesByPath.get("packages/order/src/a.ts")
          ?.map((indexed) => indexed.memberCount),
      )
      .extend("structureFormsOfASplitInterface", () =>
        buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/a.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(SPLIT_INTERFACE),
          },
        ])
          .typesByPath.get("packages/order/src/a.ts")
          ?.map((indexed) => indexed.structureForm),
      )
      .extend("structureFormsOfAWholeInterface", () =>
        buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/b.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(WHOLE_INTERFACE),
          },
        ])
          .typesByPath.get("packages/order/src/b.ts")
          ?.map((indexed) => indexed.structureForm),
      );

    it("stands as a single type", ({ typeNames }) => {
      expect(typeNames).toStrictEqual(["Shape"]);
    });

    it("carries the members of both of its declarations", ({ memberCounts }) => {
      expect(memberCounts).toStrictEqual([2]);
    });

    it("is placed at the first of its declarations", ({ lines }) => {
      expect(lines).toStrictEqual([1]);
    });

    it("reads the same as the interface written whole", ({
      structureFormsOfASplitInterface,
      structureFormsOfAWholeInterface,
    }) => {
      expect(structureFormsOfASplitInterface).toStrictEqual(structureFormsOfAWholeInterface);
    });
  });

  describe("two types sharing a name inside one workspace", () => {
    const it = test.extend("sitePaths", () =>
      buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/a.ts",
          workspacePath: WORKSPACE,
          declarations: typeDeclarationsIn(THREE_NAMED_MEMBERS),
        },
        {
          relativePath: "packages/order/src/b.ts",
          workspacePath: WORKSPACE,
          declarations: typeDeclarationsIn("export type Shape = { readonly a: string };"),
        },
      ])
        .sitesByWorkspaceName.get(workspaceNameKeyOf({ workspacePath: WORKSPACE, name: "Shape" }))
        ?.map((site) => site.relativePath));

    it("are gathered under one key", ({ sitePaths }) => {
      expect(sitePaths).toStrictEqual(["packages/order/src/a.ts", "packages/order/src/b.ts"]);
    });
  });

  describe("a structure carrying enough named members under two names", () => {
    const it = test.extend("siteCounts", () =>
      Array.from(
        buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/a.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(THREE_NAMED_MEMBERS),
          },
          {
            relativePath: "packages/order/src/b.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(
              "export type Other = { readonly a: string; readonly b: number; readonly c: Named };",
            ),
          },
        ]).sitesByStructure.values(),
      ).map((sites) => sites.length));

    it("is gathered under its own form", ({ siteCounts }) => {
      expect(siteCounts).toStrictEqual([2]);
    });
  });

  describe("a structure carrying too few members", () => {
    const it = test.extend("structureKeys", () =>
      Array.from(
        buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/a.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn("export type Shape = { readonly a: Named };"),
          },
          {
            relativePath: "packages/order/src/b.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn("export type Other = { readonly a: Named };"),
          },
        ]).sitesByStructure.keys(),
      ));

    it("is left out of the structural gathering", ({ structureKeys }) => {
      expect(structureKeys).toStrictEqual([]);
    });
  });

  describe("a structure reaching no named type", () => {
    const it = test.extend("structureKeys", () =>
      Array.from(
        buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/a.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(
              "export type Shape = { readonly a: string; readonly b: number; readonly c: boolean };",
            ),
          },
        ]).sitesByStructure.keys(),
      ));

    it("is left out of the structural gathering", ({ structureKeys }) => {
      expect(structureKeys).toStrictEqual([]);
    });
  });

  describe("sites gathered under one key from files scanned out of path order", () => {
    const it = test.extend("sitePaths", () =>
      Array.from(
        buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/b.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(THREE_NAMED_MEMBERS),
          },
          {
            relativePath: "packages/order/src/a.ts",
            workspacePath: WORKSPACE,
            declarations: typeDeclarationsIn(THREE_NAMED_MEMBERS),
          },
        ]).sitesByStructure.values(),
      ).flatMap((sites) => sites.map((site) => site.relativePath)));

    it("are ordered by path and then by line", ({ sitePaths }) => {
      expect(sitePaths).toStrictEqual(["packages/order/src/a.ts", "packages/order/src/b.ts"]);
    });
  });
});

describe("carriesNonTrivialStructure", () => {
  describe("a structure with enough members that reaches a named type", () => {
    const it = test.extend("weight", () =>
      carriesNonTrivialStructure({ memberCount: 3, referencesNamedType: true }));

    it("carries weight", ({ weight }) => {
      expect(weight).toBe(true);
    });
  });

  describe("a structure with too few members", () => {
    const it = test.extend("weight", () =>
      carriesNonTrivialStructure({ memberCount: 2, referencesNamedType: true }));

    it("carries no weight", ({ weight }) => {
      expect(weight).toBe(false);
    });
  });

  describe("a structure that reaches no named type", () => {
    const it = test.extend("weight", () =>
      carriesNonTrivialStructure({ memberCount: 9, referencesNamedType: false }));

    it("carries no weight", ({ weight }) => {
      expect(weight).toBe(false);
    });
  });
});
