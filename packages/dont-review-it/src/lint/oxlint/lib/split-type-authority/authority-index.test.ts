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

const it = test
  .extend("indexedPathsOfTwoScannedFiles", () =>
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
    ))
  .extend("typeNamesOfAFileDeclaringOneInterfaceNameTwice", () =>
    buildTypeAuthorityIndex([
      {
        relativePath: "packages/order/src/a.ts",
        workspacePath: WORKSPACE,
        declarations: typeDeclarationsIn(SPLIT_INTERFACE),
      },
    ])
      .typesByPath.get("packages/order/src/a.ts")
      ?.map((indexed) => indexed.name),
  )
  .extend("linesOfAMergedInterface", () =>
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
  .extend("memberCountsOfAMergedInterface", () =>
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
  )
  .extend("sitePathsGatheredUnderOneWorkspaceName", () =>
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
      ?.map((site) => site.relativePath),
  )
  .extend("siteCountsGatheredUnderEachStructure", () =>
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
    ).map((sites) => sites.length),
  )
  .extend("structureKeysOfStructuresCarryingTooFewMembers", () =>
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
    ),
  )
  .extend("structureKeysOfAStructureReachingNoNamedType", () =>
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
    ),
  )
  .extend("sitePathsGatheredUnderEachStructure", () =>
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
    ).flatMap((sites) => sites.map((site) => site.relativePath)),
  )
  .extend("weightOfAStructureCarryingEnoughNamedMembers", () =>
    carriesNonTrivialStructure({ memberCount: 3, referencesNamedType: true }),
  )
  .extend("weightOfAStructureCarryingTooFewMembers", () =>
    carriesNonTrivialStructure({ memberCount: 2, referencesNamedType: true }),
  )
  .extend("weightOfAStructureReachingNoNamedType", () =>
    carriesNonTrivialStructure({ memberCount: 9, referencesNamedType: false }),
  );

describe("buildTypeAuthorityIndex", () => {
  it("every scanned file is reachable by the path it was scanned at", ({
    indexedPathsOfTwoScannedFiles,
  }) => {
    expect(indexedPathsOfTwoScannedFiles).toStrictEqual([
      "packages/order/src/a.ts",
      "packages/order/src/b.ts",
    ]);
  });

  it("two declarations of one interface name in one file stand as a single type", ({
    typeNamesOfAFileDeclaringOneInterfaceNameTwice,
  }) => {
    expect(typeNamesOfAFileDeclaringOneInterfaceNameTwice).toStrictEqual(["Shape"]);
  });

  it("a merged interface carries the members of both of its declarations", ({
    memberCountsOfAMergedInterface,
  }) => {
    expect(memberCountsOfAMergedInterface).toStrictEqual([2]);
  });

  it("a merged interface is placed at the first of its declarations", ({
    linesOfAMergedInterface,
  }) => {
    expect(linesOfAMergedInterface).toStrictEqual([1]);
  });

  it("a merged interface reads the same however its declarations were split", ({
    structureFormsOfASplitInterface,
    structureFormsOfAWholeInterface,
  }) => {
    expect(structureFormsOfASplitInterface).toStrictEqual(structureFormsOfAWholeInterface);
  });

  it("types sharing a name inside one workspace are gathered under one key", ({
    sitePathsGatheredUnderOneWorkspaceName,
  }) => {
    expect(sitePathsGatheredUnderOneWorkspaceName).toStrictEqual([
      "packages/order/src/a.ts",
      "packages/order/src/b.ts",
    ]);
  });

  it("a structure carrying enough named members is gathered under its own form", ({
    siteCountsGatheredUnderEachStructure,
  }) => {
    expect(siteCountsGatheredUnderEachStructure).toStrictEqual([2]);
  });

  it("a structure carrying too few members is left out of the structural gathering", ({
    structureKeysOfStructuresCarryingTooFewMembers,
  }) => {
    expect(structureKeysOfStructuresCarryingTooFewMembers).toStrictEqual([]);
  });

  it("a structure reaching no named type is left out of the structural gathering", ({
    structureKeysOfAStructureReachingNoNamedType,
  }) => {
    expect(structureKeysOfAStructureReachingNoNamedType).toStrictEqual([]);
  });

  it("sites gathered under one key are ordered by path and then by line", ({
    sitePathsGatheredUnderEachStructure,
  }) => {
    expect(sitePathsGatheredUnderEachStructure).toStrictEqual([
      "packages/order/src/a.ts",
      "packages/order/src/b.ts",
    ]);
  });
});

describe("carriesNonTrivialStructure", () => {
  it("a structure with enough members that reaches a named type carries weight", ({
    weightOfAStructureCarryingEnoughNamedMembers,
  }) => {
    expect(weightOfAStructureCarryingEnoughNamedMembers).toBe(true);
  });

  it("a structure with too few members carries no weight", ({
    weightOfAStructureCarryingTooFewMembers,
  }) => {
    expect(weightOfAStructureCarryingTooFewMembers).toBe(false);
  });

  it("a structure that reaches no named type carries no weight", ({
    weightOfAStructureReachingNoNamedType,
  }) => {
    expect(weightOfAStructureReachingNoNamedType).toBe(false);
  });
});
