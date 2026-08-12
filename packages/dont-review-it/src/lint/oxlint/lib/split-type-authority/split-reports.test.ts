import { describe, expect, test } from "vite-plus/test";

import { buildTypeAuthorityIndex, type ScannedTypeFile } from "./authority-index.ts";
import {
  SPLIT_NAME_MESSAGE_ID,
  SPLIT_SHAPE_MESSAGE_ID,
  splitTypeReportsIn,
} from "./split-reports.ts";
import { typeDeclarationsIn } from "./type-declarations.ts";

type Placement = {
  readonly relativePath: string;
  readonly workspacePath: string;
};

const SUBJECT: Placement = {
  relativePath: "packages/order/src/subject.ts",
  workspacePath: "packages/order",
};

const OTHER_PLACEMENT: Placement = {
  relativePath: "packages/order/src/other.ts",
  workspacePath: "packages/order",
};

const FAR: Placement = {
  relativePath: "packages/basket/src/other.ts",
  workspacePath: "packages/basket",
};

const THREE_NAMED_MEMBERS = "{ readonly a: string; readonly b: number; readonly c: Named }";

const fileAt = (placement: Placement, source: string): ScannedTypeFile => ({
  relativePath: placement.relativePath,
  workspacePath: placement.workspacePath,
  declarations: typeDeclarationsIn(source),
});

const reportsIn = (
  files: readonly ScannedTypeFile[],
  relativePath: string = SUBJECT.relativePath,
) => splitTypeReportsIn({ index: buildTypeAuthorityIndex(files), relativePath });

describe("splitTypeReportsIn on one name carrying two shapes", () => {
  const splitShapeFiles = [
    fileAt(SUBJECT, `export type Shape = ${THREE_NAMED_MEMBERS};`),
    fileAt(OTHER_PLACEMENT, "export type Shape = { readonly a: string };"),
  ];

  test("a name declared with two shapes inside one workspace is reported", () => {
    expect(reportsIn(splitShapeFiles).map((report) => report.messageId)).toStrictEqual([
      SPLIT_SHAPE_MESSAGE_ID,
    ]);
  });

  test("the report names the type whose shape is split", () => {
    expect(reportsIn(splitShapeFiles).at(0)?.data.name).toBe("Shape");
  });

  test("the report places the other declaration inside the workspace", () => {
    expect(reportsIn(splitShapeFiles).at(0)?.data.sites).toBe("src/other.ts:1");
  });

  test("a workspace that is the repository root places the other declaration from the root", () => {
    const rootSubject: Placement = { relativePath: "src/subject.ts", workspacePath: "" };
    const rootOther: Placement = { relativePath: "src/other.ts", workspacePath: "" };

    expect(
      reportsIn(
        [
          fileAt(rootSubject, `export type Shape = ${THREE_NAMED_MEMBERS};`),
          fileAt(rootOther, "export type Shape = { readonly a: string };"),
        ],
        rootSubject.relativePath,
      ).at(0)?.data.sites,
    ).toBe("src/other.ts:1");
  });

  test("a name declared with one shape twice is left to the rule that reads exact matches", () => {
    expect(
      reportsIn([
        fileAt(SUBJECT, `export type Shape = ${THREE_NAMED_MEMBERS};`),
        fileAt(OTHER_PLACEMENT, `export type Shape = ${THREE_NAMED_MEMBERS};`),
      ]),
    ).toStrictEqual([]);
  });

  test("a name declared with two shapes in two workspaces is left alone", () => {
    expect(
      reportsIn([
        fileAt(SUBJECT, `export type Shape = ${THREE_NAMED_MEMBERS};`),
        fileAt(FAR, "export type Shape = { readonly a: string };"),
      ]),
    ).toStrictEqual([]);
  });

  test("an interface spread over two declarations of one file is not split against itself", () => {
    expect(
      reportsIn([
        fileAt(
          SUBJECT,
          "export interface Shape { readonly a: string }\nexport interface Shape { readonly b: Named }\n",
        ),
      ]),
    ).toStrictEqual([]);
  });

  test("an interface and a type alias of one name are read as two shapes", () => {
    expect(
      reportsIn([
        fileAt(SUBJECT, `export interface Shape ${THREE_NAMED_MEMBERS}`),
        fileAt(OTHER_PLACEMENT, `export type Shape = ${THREE_NAMED_MEMBERS};`),
      ]).map((report) => report.messageId),
    ).toStrictEqual([SPLIT_SHAPE_MESSAGE_ID]);
  });
});

describe("splitTypeReportsIn on one shape carrying two names", () => {
  const splitNameFiles = [
    fileAt(SUBJECT, `export type Shape = ${THREE_NAMED_MEMBERS};`),
    fileAt(FAR, `export type Basket = ${THREE_NAMED_MEMBERS};`),
  ];

  test("a structure declared under two names anywhere in the repository is reported", () => {
    expect(reportsIn(splitNameFiles).map((report) => report.messageId)).toStrictEqual([
      SPLIT_NAME_MESSAGE_ID,
    ]);
  });

  test("the report places the other declaration from the repository root", () => {
    expect(reportsIn(splitNameFiles).at(0)?.data.sites).toBe(
      "packages/basket/src/other.ts:1 (Basket)",
    );
  });

  test("a structure declared under one name twice is left to the rule that reads exact matches", () => {
    expect(
      reportsIn([
        fileAt(SUBJECT, `export type Shape = ${THREE_NAMED_MEMBERS};`),
        fileAt(FAR, `export type Shape = ${THREE_NAMED_MEMBERS};`),
      ]),
    ).toStrictEqual([]);
  });

  test("a structure too small to stand out is left alone however many names it carries", () => {
    expect(
      reportsIn([
        fileAt(SUBJECT, "export type Shape = { readonly a: Named };"),
        fileAt(OTHER_PLACEMENT, "export type Basket = { readonly a: Named };"),
      ]),
    ).toStrictEqual([]);
  });

  test("a structure built from primitives alone is left alone however many names it carries", () => {
    const primitives = "{ readonly a: string; readonly b: number; readonly c: boolean }";

    expect(
      reportsIn([
        fileAt(SUBJECT, `export type Shape = ${primitives};`),
        fileAt(OTHER_PLACEMENT, `export type Basket = ${primitives};`),
      ]),
    ).toStrictEqual([]);
  });

  test("a declaration written out of another one is left alone", () => {
    const derived = "{ readonly a: Basket; readonly b: Basket; readonly c: Basket }";

    expect(
      reportsIn([
        fileAt(SUBJECT, `export type Shape = ${derived};`),
        fileAt(OTHER_PLACEMENT, `export type Basket = ${derived};`),
      ]),
    ).toStrictEqual([]);
  });

  test("two names for one structure that renames its type parameters are reported", () => {
    expect(
      reportsIn([
        fileAt(
          SUBJECT,
          "export type Shape<T> = { readonly a: T; readonly b: Named; readonly c: number };",
        ),
        fileAt(
          OTHER_PLACEMENT,
          "export type Basket<U> = { readonly a: U; readonly b: Named; readonly c: number };",
        ),
      ]).map((report) => report.messageId),
    ).toStrictEqual([SPLIT_NAME_MESSAGE_ID]);
  });
});

describe("splitTypeReportsIn on a file the index cannot place", () => {
  const built = buildTypeAuthorityIndex([
    fileAt(SUBJECT, `export type Shape = ${THREE_NAMED_MEMBERS};`),
  ]);

  test("a path the index does not hold is left alone", () => {
    expect(
      reportsIn(
        [fileAt(OTHER_PLACEMENT, `export type Shape = ${THREE_NAMED_MEMBERS};`)],
        "packages/order/src/unknown.ts",
      ),
    ).toStrictEqual([]);
  });

  test("a type the index gathers under no name of its workspace is left alone", () => {
    expect(
      splitTypeReportsIn({
        index: { ...built, sitesByWorkspaceName: new Map() },
        relativePath: SUBJECT.relativePath,
      }),
    ).toStrictEqual([]);
  });

  test("a type the index gathers under no structure of its own is left alone", () => {
    expect(
      splitTypeReportsIn({
        index: { ...built, sitesByStructure: new Map() },
        relativePath: SUBJECT.relativePath,
      }),
    ).toStrictEqual([]);
  });
});
