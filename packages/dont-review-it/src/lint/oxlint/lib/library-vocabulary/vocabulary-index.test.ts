import { describe, expect, test } from "vite-plus/test";

import { buildLibraryVocabularyIndex, libraryOwnersOf } from "./vocabulary-index.ts";

const SEVERITY_VALUES = ["allow", "deny", "error", "off", "warn"];

const it = test
  .extend("ownersOfTheValuesWrittenInTheOrderTheyWereDeclared", () =>
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
    ))
  .extend("ownersOfTheSameValuesWrittenInTheOppositeOrder", () =>
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
    ),
  )
  .extend("ownersOfThreeOfTheFiveSeverities", () =>
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
    ),
  )
  .extend("ownersOfMoreSeveritiesThanTheTypeAdmits", () =>
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
    ),
  )
  .extend("ownersOfValuesNoTypeShares", () =>
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
    ),
  )
  .extend("ownersOfDigitsWrittenAsText", () =>
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
    ),
  )
  .extend("ownersOfDigitsWrittenAsNumbers", () =>
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
    ),
  )
  .extend("ownersOfTwoNamesReachingOneDeclaration", () =>
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
    ),
  )
  .extend("ownersOfTwoDeclarationsAdmittingTheSameValues", () =>
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
    ),
  )
  .extend("ownersOfAnIndexHarvestedForwards", () =>
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
    ),
  )
  .extend("ownersOfAnIndexHarvestedBackwards", () =>
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
    ),
  )
  .extend("ownersOfNoValuesAtAll", () =>
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
    ),
  )
  .extend("ownersHeldByAnIndexBuiltFromNothing", () =>
    libraryOwnersOf(buildLibraryVocabularyIndex([]), ["draft", "published"]),
  )
  .extend("ownersOfASingleSeverity", () =>
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
    ),
  )
  .extend("ownersOfATypeThatAdmitsValuesNobodySpelledOut", () =>
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
    ),
  );

describe("vocabulary-index", () => {
  it("a type whose values are exactly the ones written here owns them", ({
    ownersOfTheValuesWrittenInTheOrderTheyWereDeclared,
  }) => {
    expect(ownersOfTheValuesWrittenInTheOrderTheyWereDeclared).toStrictEqual([
      {
        packageName: "oxlint",
        typeName: "OrderStatus",
        declarationId: "oxlint/dist/index.d.ts#OrderStatus",
        values: ["draft", "published"],
        admitsUnnamedValues: false,
      },
    ]);
  });

  it("the order the values are written in does not decide whether the type owns them", ({
    ownersOfTheSameValuesWrittenInTheOppositeOrder,
  }) => {
    expect(ownersOfTheSameValuesWrittenInTheOppositeOrder).toStrictEqual([
      {
        packageName: "oxlint",
        typeName: "OrderStatus",
        declarationId: "oxlint/dist/index.d.ts#OrderStatus",
        values: ["draft", "published"],
        admitsUnnamedValues: false,
      },
    ]);
  });

  it("a type that admits more values than are written here still owns them", ({
    ownersOfThreeOfTheFiveSeverities,
  }) => {
    expect(ownersOfThreeOfTheFiveSeverities).toStrictEqual([
      {
        packageName: "oxlint",
        typeName: "AllowWarnDeny",
        declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
        values: SEVERITY_VALUES,
        admitsUnnamedValues: false,
      },
    ]);
  });

  it("a type that admits fewer values than are written here does not own them", ({
    ownersOfMoreSeveritiesThanTheTypeAdmits,
  }) => {
    expect(ownersOfMoreSeveritiesThanTheTypeAdmits).toStrictEqual([]);
  });

  it("a type that shares no value with the ones written here does not own them", ({
    ownersOfValuesNoTypeShares,
  }) => {
    expect(ownersOfValuesNoTypeShares).toStrictEqual([]);
  });

  it("digits written as text are not the numbers a type admits", ({
    ownersOfDigitsWrittenAsText,
  }) => {
    expect(ownersOfDigitsWrittenAsText).toStrictEqual([]);
  });

  it("digits written as numbers are the values that type admits", ({
    ownersOfDigitsWrittenAsNumbers,
  }) => {
    expect(ownersOfDigitsWrittenAsNumbers).toStrictEqual([
      {
        packageName: "oxlint",
        typeName: "Digits",
        declarationId: "oxlint/dist/index.d.ts#Digits",
        values: [1, 2, 3],
        admitsUnnamedValues: false,
      },
    ]);
  });

  it("two names that reach one declaration are folded into a single candidate", ({
    ownersOfTwoNamesReachingOneDeclaration,
  }) => {
    expect(ownersOfTwoNamesReachingOneDeclaration).toStrictEqual([
      {
        packageName: "@oxlint/plugins",
        typeName: "Severity",
        declarationId: "one",
        values: SEVERITY_VALUES,
        admitsUnnamedValues: false,
      },
    ]);
  });

  it("two declarations that admit the same values are both offered as candidates", ({
    ownersOfTwoDeclarationsAdmittingTheSameValues,
  }) => {
    expect(ownersOfTwoDeclarationsAdmittingTheSameValues).toStrictEqual([
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

  it("candidates come back sorted by the package and the type that hold them", ({
    ownersOfAnIndexHarvestedForwards,
  }) => {
    expect(ownersOfAnIndexHarvestedForwards).toStrictEqual([
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

  it("candidates come back in the same order whichever order they were harvested in", ({
    ownersOfAnIndexHarvestedBackwards,
  }) => {
    expect(ownersOfAnIndexHarvestedBackwards).toStrictEqual([
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

  it("no values written here leaves nothing for a type to own", ({ ownersOfNoValuesAtAll }) => {
    expect(ownersOfNoValuesAtAll).toStrictEqual([]);
  });

  it("an index built from nothing owns nothing", ({ ownersHeldByAnIndexBuiltFromNothing }) => {
    expect(ownersHeldByAnIndexBuiltFromNothing).toStrictEqual([]);
  });

  it("a candidate carries the values it admits beyond the ones written here", ({
    ownersOfASingleSeverity,
  }) => {
    expect(ownersOfASingleSeverity).toStrictEqual([
      {
        packageName: "oxlint",
        typeName: "AllowWarnDeny",
        declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
        values: SEVERITY_VALUES,
        admitsUnnamedValues: false,
      },
    ]);
  });

  it("a candidate says when its type also admits values that are not spelled out", ({
    ownersOfATypeThatAdmitsValuesNobodySpelledOut,
  }) => {
    expect(ownersOfATypeThatAdmitsValuesNobodySpelledOut).toStrictEqual([
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
