import { describe, expect, test } from "vite-plus/test";

import {
  buildLibraryVocabularyIndex,
  libraryOwnersOf,
  type LibraryVocabularyEntry,
} from "./vocabulary-index.ts";

describe("vocabulary-index", () => {
  const harvested = (
    overrides: Partial<LibraryVocabularyEntry> & Pick<LibraryVocabularyEntry, "typeName">,
  ): LibraryVocabularyEntry => ({
    packageName: "oxlint",
    declarationId: `oxlint/dist/index.d.ts#${overrides.typeName}`,
    values: ["allow", "deny", "error", "off", "warn"],
    admitsUnnamedValues: false,
    ...overrides,
  });

  const namesOf = (owners: readonly { readonly typeName: string }[]): readonly string[] =>
    owners.map((owner) => owner.typeName);

  test("a type whose values are exactly the ones written here owns them", () => {
    const index = buildLibraryVocabularyIndex([
      harvested({ typeName: "OrderStatus", values: ["draft", "published"] }),
    ]);

    expect(namesOf(libraryOwnersOf(index, ["draft", "published"]))).toStrictEqual(["OrderStatus"]);
  });

  test("the order the values are written in does not decide whether the type owns them", () => {
    const index = buildLibraryVocabularyIndex([
      harvested({ typeName: "OrderStatus", values: ["draft", "published"] }),
    ]);

    expect(namesOf(libraryOwnersOf(index, ["published", "draft"]))).toStrictEqual(["OrderStatus"]);
  });

  test("a type that admits more values than are written here still owns them", () => {
    const index = buildLibraryVocabularyIndex([harvested({ typeName: "AllowWarnDeny" })]);

    expect(namesOf(libraryOwnersOf(index, ["error", "warn", "off"]))).toStrictEqual([
      "AllowWarnDeny",
    ]);
  });

  test("a type that admits fewer values than are written here does not own them", () => {
    const index = buildLibraryVocabularyIndex([
      harvested({ typeName: "LogType", values: ["error", "warn"] }),
    ]);

    expect(libraryOwnersOf(index, ["error", "warn", "off"])).toStrictEqual([]);
  });

  test("a type that shares no value with the ones written here does not own them", () => {
    const index = buildLibraryVocabularyIndex([
      harvested({ typeName: "SSRTarget", values: ["node", "webworker"] }),
    ]);

    expect(libraryOwnersOf(index, ["draft", "published"])).toStrictEqual([]);
  });

  test("a number and the same digits written as text are different values", () => {
    const index = buildLibraryVocabularyIndex([
      harvested({ typeName: "Digits", values: [1, 2, 3] }),
    ]);

    expect(libraryOwnersOf(index, ["1", "2"])).toStrictEqual([]);
    expect(namesOf(libraryOwnersOf(index, [1, 2]))).toStrictEqual(["Digits"]);
  });

  test("two names that reach one declaration are folded into a single candidate", () => {
    const index = buildLibraryVocabularyIndex([
      harvested({ packageName: "oxlint", typeName: "AllowWarnDeny", declarationId: "one" }),
      harvested({ packageName: "@oxlint/plugins", typeName: "Severity", declarationId: "one" }),
    ]);

    expect(namesOf(libraryOwnersOf(index, ["error", "warn"]))).toStrictEqual(["Severity"]);
  });

  test("two declarations that admit the same values are both offered as candidates", () => {
    const index = buildLibraryVocabularyIndex([
      harvested({ typeName: "AllowWarnDeny", declarationId: "one" }),
      harvested({ typeName: "DummyRule", declarationId: "two" }),
    ]);

    expect(namesOf(libraryOwnersOf(index, ["error", "warn"]))).toStrictEqual([
      "AllowWarnDeny",
      "DummyRule",
    ]);
  });

  test("candidates come back in the same order whichever order they were harvested in", () => {
    const forward = buildLibraryVocabularyIndex([
      harvested({ packageName: "vite", typeName: "LogLevel", declarationId: "one" }),
      harvested({ packageName: "oxlint", typeName: "AllowWarnDeny", declarationId: "two" }),
    ]);
    const backward = buildLibraryVocabularyIndex([
      harvested({ packageName: "oxlint", typeName: "AllowWarnDeny", declarationId: "two" }),
      harvested({ packageName: "vite", typeName: "LogLevel", declarationId: "one" }),
    ]);

    expect(namesOf(libraryOwnersOf(forward, ["error", "warn"]))).toStrictEqual([
      "AllowWarnDeny",
      "LogLevel",
    ]);
    expect(namesOf(libraryOwnersOf(backward, ["error", "warn"]))).toStrictEqual(
      namesOf(libraryOwnersOf(forward, ["error", "warn"])),
    );
  });

  test("no values written here leaves nothing for a type to own", () => {
    const index = buildLibraryVocabularyIndex([harvested({ typeName: "AllowWarnDeny" })]);

    expect(libraryOwnersOf(index, [])).toStrictEqual([]);
  });

  test("an index built from nothing owns nothing", () => {
    expect(libraryOwnersOf(buildLibraryVocabularyIndex([]), ["draft", "published"])).toStrictEqual(
      [],
    );
  });

  test("a candidate carries the values it admits beyond the ones written here", () => {
    const index = buildLibraryVocabularyIndex([harvested({ typeName: "AllowWarnDeny" })]);

    const [owner] = libraryOwnersOf(index, ["error", "warn", "off"]);
    if (owner === undefined) throw new Error("the harvested type must own the severity vocabulary");

    expect(owner.values).toStrictEqual(["allow", "deny", "error", "off", "warn"]);
    expect(owner.packageName).toBe("oxlint");
  });

  test("a candidate says when its type also admits values that are not spelled out", () => {
    const index = buildLibraryVocabularyIndex([
      harvested({ typeName: "AllowWarnDeny", admitsUnnamedValues: true }),
    ]);

    const [owner] = libraryOwnersOf(index, ["error", "warn"]);
    if (owner === undefined) throw new Error("the harvested type must own the severity vocabulary");

    expect(owner.admitsUnnamedValues).toBe(true);
  });
});
