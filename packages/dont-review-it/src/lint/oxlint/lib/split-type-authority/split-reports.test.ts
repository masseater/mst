import { describe, expect, test } from "vite-plus/test";

import { buildTypeAuthorityIndex } from "./authority-index.ts";
import {
  SPLIT_NAME_MESSAGE_ID,
  SPLIT_SHAPE_MESSAGE_ID,
  splitTypeReportsIn,
} from "./split-reports.ts";
import { typeDeclarationsIn } from "./type-declarations.ts";

const THREE_NAMED_MEMBERS = "{ readonly a: string; readonly b: number; readonly c: Named }";

describe("splitTypeReportsIn", () => {
  describe("one name carrying two shapes", () => {
    describe("a name declared with two shapes inside one workspace", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is reported", ({ reports }) => {
        expect(reports).toStrictEqual([
          {
            line: 1,
            messageId: SPLIT_SHAPE_MESSAGE_ID,
            data: { name: "Shape", sites: "src/other.ts:1" },
          },
        ]);
      });

      it("is reported under the name whose shape is split", ({ reports }) => {
        expect(reports).toStrictEqual([
          {
            line: 1,
            messageId: SPLIT_SHAPE_MESSAGE_ID,
            data: { name: "Shape", sites: "src/other.ts:1" },
          },
        ]);
      });

      it("is reported with the other declaration placed inside the workspace", ({ reports }) => {
        expect(reports).toStrictEqual([
          {
            line: 1,
            messageId: SPLIT_SHAPE_MESSAGE_ID,
            data: { name: "Shape", sites: "src/other.ts:1" },
          },
        ]);
      });
    });

    describe("a workspace that is the repository root", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("places the other declaration from the root", ({ reports }) => {
        expect(reports).toStrictEqual([
          {
            line: 1,
            messageId: SPLIT_SHAPE_MESSAGE_ID,
            data: { name: "Shape", sites: "src/other.ts:1" },
          },
        ]);
      });
    });

    describe("a name declared with one shape twice", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is left to the rule that reads exact matches", ({ reports }) => {
        expect(reports).toStrictEqual([]);
      });
    });

    describe("a name declared with two shapes in two workspaces", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is left alone", ({ reports }) => {
        expect(reports).toStrictEqual([]);
      });
    });

    describe("an interface spread over two declarations of one file", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is not split against itself", ({ reports }) => {
        expect(reports).toStrictEqual([]);
      });
    });

    describe("an interface and a type alias of one name", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("are read as two shapes", ({ reports }) => {
        expect(reports).toStrictEqual([
          {
            line: 1,
            messageId: SPLIT_SHAPE_MESSAGE_ID,
            data: { name: "Shape", sites: "src/other.ts:1" },
          },
        ]);
      });
    });
  });

  describe("one shape carrying two names", () => {
    describe("a structure declared under two names anywhere in the repository", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is reported", ({ reports }) => {
        expect(reports).toStrictEqual([
          {
            line: 1,
            messageId: SPLIT_NAME_MESSAGE_ID,
            data: { name: "Shape", sites: "packages/basket/src/other.ts:1 (Basket)" },
          },
        ]);
      });

      it("is reported with the other declaration placed from the repository root", ({
        reports,
      }) => {
        expect(reports).toStrictEqual([
          {
            line: 1,
            messageId: SPLIT_NAME_MESSAGE_ID,
            data: { name: "Shape", sites: "packages/basket/src/other.ts:1 (Basket)" },
          },
        ]);
      });
    });

    describe("a structure declared under one name twice", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is left to the rule that reads exact matches", ({ reports }) => {
        expect(reports).toStrictEqual([]);
      });
    });

    describe("a structure too small to stand out", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is left alone however many names it carries", ({ reports }) => {
        expect(reports).toStrictEqual([]);
      });
    });

    describe("a structure built from primitives alone", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is left alone however many names it carries", ({ reports }) => {
        expect(reports).toStrictEqual([]);
      });
    });

    describe("a declaration written out of another one", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is left alone", ({ reports }) => {
        expect(reports).toStrictEqual([]);
      });
    });

    describe("one structure that renames its type parameters", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is reported under both of its names", ({ reports }) => {
        expect(reports).toStrictEqual([
          {
            line: 1,
            messageId: SPLIT_NAME_MESSAGE_ID,
            data: { name: "Shape", sites: "packages/order/src/other.ts:1 (Basket)" },
          },
        ]);
      });
    });
  });

  describe("a file the index cannot place", () => {
    describe("a path the index does not hold", () => {
      const it = test.extend("reports", () =>
        splitTypeReportsIn({
          index: buildTypeAuthorityIndex([
            {
              relativePath: "packages/order/src/other.ts",
              workspacePath: "packages/order",
              declarations: typeDeclarationsIn(`export type Shape = ${THREE_NAMED_MEMBERS};`),
            },
          ]),
          relativePath: "packages/order/src/unknown.ts",
        }));

      it("is left alone", ({ reports }) => {
        expect(reports).toStrictEqual([]);
      });
    });

    describe("a type the index gathers under no name of its workspace", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is left alone", ({ reports }) => {
        expect(reports).toStrictEqual([]);
      });
    });

    describe("a type the index gathers under no structure of its own", () => {
      const it = test.extend("reports", () =>
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
        }));

      it("is left alone", ({ reports }) => {
        expect(reports).toStrictEqual([]);
      });
    });
  });
});
