import { expect, test } from "vite-plus/test";

import { describeLibraryOwner } from "./owner-description.ts";

import type { LibraryVocabularyEntry } from "./vocabulary-index.ts";

const severity = (overrides: Partial<LibraryVocabularyEntry>): LibraryVocabularyEntry => ({
  packageName: "oxlint",
  typeName: "AllowWarnDeny",
  declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
  values: ["error", "warn", "off"],
  admitsUnnamedValues: false,
  ...overrides,
});

test("a type that admits exactly these values is named without asking for narrowing", () => {
  expect(describeLibraryOwner(severity({}), ["error", "warn", "off"])).toBe(
    "AllowWarnDeny from oxlint",
  );
});

test("a type that admits more values names the ones it admits beyond these", () => {
  const entry = severity({ values: ["allow", "deny", "error", "off", "warn"] });

  expect(describeLibraryOwner(entry, ["error", "warn", "off"])).toBe(
    'AllowWarnDeny from oxlint (which also admits "allow" | "deny", so narrow it)',
  );
});

test("a type that admits values outside its literals says so instead of listing them", () => {
  const entry = severity({ admitsUnnamedValues: true });

  expect(describeLibraryOwner(entry, ["error", "warn", "off"])).toBe(
    "AllowWarnDeny from oxlint (which also admits values that are not spelled out as literals, so narrow it)",
  );
});

test("a type that is wider in both ways names the extra literals and says the rest is open", () => {
  const entry = severity({
    values: ["allow", "deny", "error", "off", "warn"],
    admitsUnnamedValues: true,
  });

  expect(describeLibraryOwner(entry, ["error", "warn", "off"])).toBe(
    'AllowWarnDeny from oxlint (which also admits "allow" | "deny" and values that are not spelled out as literals, so narrow it)',
  );
});

test("numbers keep their spelling apart from the text that looks the same", () => {
  const entry = severity({ typeName: "Digits", values: [1, 2, "2"] });

  expect(describeLibraryOwner(entry, [1])).toBe(
    'Digits from oxlint (which also admits 2 | "2", so narrow it)',
  );
});
