import { describe, expect, test } from "vite-plus/test";

import { buildTypeAuthorityIndex } from "./authority-index.ts";
import {
  SPLIT_NAME_MESSAGE_ID,
  SPLIT_SHAPE_MESSAGE_ID,
  splitTypeReportsIn,
} from "./split-reports.ts";
import { typeDeclarationsIn } from "./type-declarations.ts";

const THREE_NAMED_MEMBERS = "{ readonly a: string; readonly b: number; readonly c: Named }";

const it = test
  .extend("reportsOfANameCarryingTwoShapesInOneWorkspace", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
        },
        {
          relativePath: "packages/order/src/other.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn("export type Shape = { readonly a: string };"),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }))
  .extend("reportsOfANameCarryingTwoShapesAtTheRepositoryRoot", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "src/subject.ts",
          workspacePath: "",
          declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
        },
        {
          relativePath: "src/other.ts",
          workspacePath: "",
          declarations: typeDeclarationsIn("export type Shape = { readonly a: string };"),
        },
      ]),
      relativePath: "src/subject.ts",
    }),
  )
  .extend("reportsOfANameCarryingOneShapeTwice", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
        },
        {
          relativePath: "packages/order/src/other.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfANameCarryingTwoShapesInTwoWorkspaces", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
        },
        {
          relativePath: "packages/basket/src/other.ts",
          workspacePath: "packages/basket",
          declarations: typeDeclarationsIn("export type Shape = { readonly a: string };"),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfAnInterfaceSpreadOverTwoDeclarationsOfOneFile", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(
            "export interface Shape { readonly a: string }\nexport interface Shape { readonly b: Named }\n",
          ),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfAnInterfaceAndAnAliasOfOneName", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(`export interface Shape ${THREE_NAMED_MEMBERS}`),
        },
        {
          relativePath: "packages/order/src/other.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfAStructureCarryingTwoNames", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
        },
        {
          relativePath: "packages/basket/src/other.ts",
          workspacePath: "packages/basket",
          declarations: typeDeclarationsIn(`export type Basket = ${THREE_NAMED_MEMBERS};`),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfAStructureCarryingOneNameTwice", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
        },
        {
          relativePath: "packages/basket/src/other.ts",
          workspacePath: "packages/basket",
          declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfASmallStructureCarryingTwoNames", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn("export type Shape = { readonly a: Named };"),
        },
        {
          relativePath: "packages/order/src/other.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn("export type Basket = { readonly a: Named };"),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfAPrimitiveStructureCarryingTwoNames", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(
            "export type Shape = { readonly a: string; readonly b: number; readonly c: boolean };",
          ),
        },
        {
          relativePath: "packages/order/src/other.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(
            "export type Basket = { readonly a: string; readonly b: number; readonly c: boolean };",
          ),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfAStructureWrittenOutOfAnother", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(
            "export type Shape = { readonly a: Basket; readonly b: Basket; readonly c: Basket };",
          ),
        },
        {
          relativePath: "packages/order/src/other.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(
            "export type Basket = { readonly a: Basket; readonly b: Basket; readonly c: Basket };",
          ),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfAStructureRenamingItsTypeParameters", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/subject.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(
            "export type Shape<T> = { readonly a: T; readonly b: Named; readonly c: number };",
          ),
        },
        {
          relativePath: "packages/order/src/other.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(
            "export type Basket<U> = { readonly a: U; readonly b: Named; readonly c: number };",
          ),
        },
      ]),
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfAPathTheIndexDoesNotHold", () =>
    splitTypeReportsIn({
      index: buildTypeAuthorityIndex([
        {
          relativePath: "packages/order/src/other.ts",
          workspacePath: "packages/order",
          declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
        },
      ]),
      relativePath: "packages/order/src/unknown.ts",
    }),
  )
  .extend("reportsOfATypeGatheredUnderNoWorkspaceName", () =>
    splitTypeReportsIn({
      index: {
        ...buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/subject.ts",
            workspacePath: "packages/order",
            declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
          },
        ]),
        sitesByWorkspaceName: new Map(),
      },
      relativePath: "packages/order/src/subject.ts",
    }),
  )
  .extend("reportsOfATypeGatheredUnderNoStructure", () =>
    splitTypeReportsIn({
      index: {
        ...buildTypeAuthorityIndex([
          {
            relativePath: "packages/order/src/subject.ts",
            workspacePath: "packages/order",
            declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
          },
        ]),
        sitesByStructure: new Map(),
      },
      relativePath: "packages/order/src/subject.ts",
    }),
  );

describe("splitTypeReportsIn on one name carrying two shapes", () => {
  it("a name declared with two shapes inside one workspace is reported", ({
    reportsOfANameCarryingTwoShapesInOneWorkspace,
  }) => {
    expect(reportsOfANameCarryingTwoShapesInOneWorkspace).toStrictEqual([
      {
        line: 1,
        messageId: SPLIT_SHAPE_MESSAGE_ID,
        data: { name: "Shape", sites: "src/other.ts:1" },
      },
    ]);
  });

  it("the report names the type whose shape is split", ({
    reportsOfANameCarryingTwoShapesInOneWorkspace,
  }) => {
    expect(reportsOfANameCarryingTwoShapesInOneWorkspace).toStrictEqual([
      {
        line: 1,
        messageId: SPLIT_SHAPE_MESSAGE_ID,
        data: { name: "Shape", sites: "src/other.ts:1" },
      },
    ]);
  });

  it("the report places the other declaration inside the workspace", ({
    reportsOfANameCarryingTwoShapesInOneWorkspace,
  }) => {
    expect(reportsOfANameCarryingTwoShapesInOneWorkspace).toStrictEqual([
      {
        line: 1,
        messageId: SPLIT_SHAPE_MESSAGE_ID,
        data: { name: "Shape", sites: "src/other.ts:1" },
      },
    ]);
  });

  it("a workspace that is the repository root places the other declaration from the root", ({
    reportsOfANameCarryingTwoShapesAtTheRepositoryRoot,
  }) => {
    expect(reportsOfANameCarryingTwoShapesAtTheRepositoryRoot).toStrictEqual([
      {
        line: 1,
        messageId: SPLIT_SHAPE_MESSAGE_ID,
        data: { name: "Shape", sites: "src/other.ts:1" },
      },
    ]);
  });

  it("a name declared with one shape twice is left to the rule that reads exact matches", ({
    reportsOfANameCarryingOneShapeTwice,
  }) => {
    expect(reportsOfANameCarryingOneShapeTwice).toStrictEqual([]);
  });

  it("a name declared with two shapes in two workspaces is left alone", ({
    reportsOfANameCarryingTwoShapesInTwoWorkspaces,
  }) => {
    expect(reportsOfANameCarryingTwoShapesInTwoWorkspaces).toStrictEqual([]);
  });

  it("an interface spread over two declarations of one file is not split against itself", ({
    reportsOfAnInterfaceSpreadOverTwoDeclarationsOfOneFile,
  }) => {
    expect(reportsOfAnInterfaceSpreadOverTwoDeclarationsOfOneFile).toStrictEqual([]);
  });

  it("an interface and a type alias of one name are read as two shapes", ({
    reportsOfAnInterfaceAndAnAliasOfOneName,
  }) => {
    expect(reportsOfAnInterfaceAndAnAliasOfOneName).toStrictEqual([
      {
        line: 1,
        messageId: SPLIT_SHAPE_MESSAGE_ID,
        data: { name: "Shape", sites: "src/other.ts:1" },
      },
    ]);
  });
});

describe("splitTypeReportsIn on one shape carrying two names", () => {
  it("a structure declared under two names anywhere in the repository is reported", ({
    reportsOfAStructureCarryingTwoNames,
  }) => {
    expect(reportsOfAStructureCarryingTwoNames).toStrictEqual([
      {
        line: 1,
        messageId: SPLIT_NAME_MESSAGE_ID,
        data: { name: "Shape", sites: "packages/basket/src/other.ts:1 (Basket)" },
      },
    ]);
  });

  it("the report places the other declaration from the repository root", ({
    reportsOfAStructureCarryingTwoNames,
  }) => {
    expect(reportsOfAStructureCarryingTwoNames).toStrictEqual([
      {
        line: 1,
        messageId: SPLIT_NAME_MESSAGE_ID,
        data: { name: "Shape", sites: "packages/basket/src/other.ts:1 (Basket)" },
      },
    ]);
  });

  it("a structure declared under one name twice is left to the rule that reads exact matches", ({
    reportsOfAStructureCarryingOneNameTwice,
  }) => {
    expect(reportsOfAStructureCarryingOneNameTwice).toStrictEqual([]);
  });

  it("a structure too small to stand out is left alone however many names it carries", ({
    reportsOfASmallStructureCarryingTwoNames,
  }) => {
    expect(reportsOfASmallStructureCarryingTwoNames).toStrictEqual([]);
  });

  it("a structure built from primitives alone is left alone however many names it carries", ({
    reportsOfAPrimitiveStructureCarryingTwoNames,
  }) => {
    expect(reportsOfAPrimitiveStructureCarryingTwoNames).toStrictEqual([]);
  });

  it("a declaration written out of another one is left alone", ({
    reportsOfAStructureWrittenOutOfAnother,
  }) => {
    expect(reportsOfAStructureWrittenOutOfAnother).toStrictEqual([]);
  });

  it("two names for one structure that renames its type parameters are reported", ({
    reportsOfAStructureRenamingItsTypeParameters,
  }) => {
    expect(reportsOfAStructureRenamingItsTypeParameters).toStrictEqual([
      {
        line: 1,
        messageId: SPLIT_NAME_MESSAGE_ID,
        data: { name: "Shape", sites: "packages/order/src/other.ts:1 (Basket)" },
      },
    ]);
  });
});

describe("splitTypeReportsIn on a file the index cannot place", () => {
  it("a path the index does not hold is left alone", ({ reportsOfAPathTheIndexDoesNotHold }) => {
    expect(reportsOfAPathTheIndexDoesNotHold).toStrictEqual([]);
  });

  it("a type the index gathers under no name of its workspace is left alone", ({
    reportsOfATypeGatheredUnderNoWorkspaceName,
  }) => {
    expect(reportsOfATypeGatheredUnderNoWorkspaceName).toStrictEqual([]);
  });

  it("a type the index gathers under no structure of its own is left alone", ({
    reportsOfATypeGatheredUnderNoStructure,
  }) => {
    expect(reportsOfATypeGatheredUnderNoStructure).toStrictEqual([]);
  });
});
