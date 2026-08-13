import { describe, expect, test } from "vite-plus/test";

import { buildLibraryVocabularyIndex, libraryOwnersOf } from "./vocabulary-index.ts";

const SEVERITY_VALUES = ["allow", "deny", "error", "off", "warn"];

describe("libraryOwnersOf", () => {
  describe("a type whose values are exactly the ones written here", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "OrderStatus",
            declarationId: "oxlint/dist/index.d.ts#OrderStatus",
            values: ["draft", "published"],
            admitsUnnamedValues: false,
          },
        ]),
        ["draft", "published"],
      ));

    it("owns them", ({ owners }) => {
      expect(owners).toStrictEqual([
        {
          packageName: "oxlint",
          typeName: "OrderStatus",
          declarationId: "oxlint/dist/index.d.ts#OrderStatus",
          values: ["draft", "published"],
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("a type whose values are the ones written here in the opposite order", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "OrderStatus",
            declarationId: "oxlint/dist/index.d.ts#OrderStatus",
            values: ["draft", "published"],
            admitsUnnamedValues: false,
          },
        ]),
        ["published", "draft"],
      ));

    it("owns them just the same, so the order they are written in does not decide it", ({
      owners,
    }) => {
      expect(owners).toStrictEqual([
        {
          packageName: "oxlint",
          typeName: "OrderStatus",
          declarationId: "oxlint/dist/index.d.ts#OrderStatus",
          values: ["draft", "published"],
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("a type that admits more values than are written here", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "AllowWarnDeny",
            declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
        ]),
        ["error", "warn", "off"],
      ));

    it("still owns them", ({ owners }) => {
      expect(owners).toStrictEqual([
        {
          packageName: "oxlint",
          typeName: "AllowWarnDeny",
          declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
          values: SEVERITY_VALUES,
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("a type that admits fewer values than are written here", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "LogType",
            declarationId: "oxlint/dist/index.d.ts#LogType",
            values: ["error", "warn"],
            admitsUnnamedValues: false,
          },
        ]),
        ["error", "warn", "off"],
      ));

    it("does not own them", ({ owners }) => {
      expect(owners).toStrictEqual([]);
    });
  });

  describe("a type that shares no value with the ones written here", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "SSRTarget",
            declarationId: "oxlint/dist/index.d.ts#SSRTarget",
            values: ["node", "webworker"],
            admitsUnnamedValues: false,
          },
        ]),
        ["draft", "published"],
      ));

    it("does not own them", ({ owners }) => {
      expect(owners).toStrictEqual([]);
    });
  });

  describe("digits written as text against a type admitting the numbers", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "Digits",
            declarationId: "oxlint/dist/index.d.ts#Digits",
            values: [1, 2, 3],
            admitsUnnamedValues: false,
          },
        ]),
        ["1", "2"],
      ));

    it("are not the numbers that type admits", ({ owners }) => {
      expect(owners).toStrictEqual([]);
    });
  });

  describe("digits written as numbers against a type admitting the numbers", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "Digits",
            declarationId: "oxlint/dist/index.d.ts#Digits",
            values: [1, 2, 3],
            admitsUnnamedValues: false,
          },
        ]),
        [1, 2],
      ));

    it("are the values that type admits", ({ owners }) => {
      expect(owners).toStrictEqual([
        {
          packageName: "oxlint",
          typeName: "Digits",
          declarationId: "oxlint/dist/index.d.ts#Digits",
          values: [1, 2, 3],
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("two names that reach one declaration", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "AllowWarnDeny",
            declarationId: "one",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
          {
            packageName: "@oxlint/plugins",
            typeName: "Severity",
            declarationId: "one",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
        ]),
        ["error", "warn"],
      ));

    it("are folded into a single candidate", ({ owners }) => {
      expect(owners).toStrictEqual([
        {
          packageName: "@oxlint/plugins",
          typeName: "Severity",
          declarationId: "one",
          values: SEVERITY_VALUES,
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("two declarations that admit the same values", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "AllowWarnDeny",
            declarationId: "one",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
          {
            packageName: "oxlint",
            typeName: "DummyRule",
            declarationId: "two",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
        ]),
        ["error", "warn"],
      ));

    it("are both offered as candidates", ({ owners }) => {
      expect(owners).toStrictEqual([
        {
          packageName: "oxlint",
          typeName: "AllowWarnDeny",
          declarationId: "one",
          values: SEVERITY_VALUES,
          admitsUnnamedValues: false,
        },
        {
          packageName: "oxlint",
          typeName: "DummyRule",
          declarationId: "two",
          values: SEVERITY_VALUES,
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("an index harvested with the later package first", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "vite",
            typeName: "LogLevel",
            declarationId: "one",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
          {
            packageName: "oxlint",
            typeName: "AllowWarnDeny",
            declarationId: "two",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
        ]),
        ["error", "warn"],
      ));

    it("hands its candidates back sorted by the package and the type that hold them", ({
      owners,
    }) => {
      expect(owners).toStrictEqual([
        {
          packageName: "oxlint",
          typeName: "AllowWarnDeny",
          declarationId: "two",
          values: SEVERITY_VALUES,
          admitsUnnamedValues: false,
        },
        {
          packageName: "vite",
          typeName: "LogLevel",
          declarationId: "one",
          values: SEVERITY_VALUES,
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("an index harvested with the earlier package first", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "AllowWarnDeny",
            declarationId: "two",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
          {
            packageName: "vite",
            typeName: "LogLevel",
            declarationId: "one",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
        ]),
        ["error", "warn"],
      ));

    it("hands its candidates back in that same order, whichever order they were harvested in", ({
      owners,
    }) => {
      expect(owners).toStrictEqual([
        {
          packageName: "oxlint",
          typeName: "AllowWarnDeny",
          declarationId: "two",
          values: SEVERITY_VALUES,
          admitsUnnamedValues: false,
        },
        {
          packageName: "vite",
          typeName: "LogLevel",
          declarationId: "one",
          values: SEVERITY_VALUES,
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("no values written here at all", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "AllowWarnDeny",
            declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
        ]),
        [],
      ));

    it("leaves nothing for a type to own", ({ owners }) => {
      expect(owners).toStrictEqual([]);
    });
  });

  describe("an index built from nothing", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(buildLibraryVocabularyIndex([]), ["draft", "published"]));

    it("owns nothing", ({ owners }) => {
      expect(owners).toStrictEqual([]);
    });
  });

  describe("a single severity written against a type admitting five", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "AllowWarnDeny",
            declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: false,
          },
        ]),
        ["error"],
      ));

    it("hands back a candidate carrying the values it admits beyond the one written here", ({
      owners,
    }) => {
      expect(owners).toStrictEqual([
        {
          packageName: "oxlint",
          typeName: "AllowWarnDeny",
          declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
          values: SEVERITY_VALUES,
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("a type that also admits values nobody spelled out", () => {
    const it = test.extend("owners", () =>
      libraryOwnersOf(
        buildLibraryVocabularyIndex([
          {
            packageName: "oxlint",
            typeName: "AllowWarnDeny",
            declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
            values: SEVERITY_VALUES,
            admitsUnnamedValues: true,
          },
        ]),
        ["error", "warn"],
      ));

    it("hands back a candidate that says so", ({ owners }) => {
      expect(owners).toStrictEqual([
        {
          packageName: "oxlint",
          typeName: "AllowWarnDeny",
          declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
          values: SEVERITY_VALUES,
          admitsUnnamedValues: true,
        },
      ]);
    });
  });
});
