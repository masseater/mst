import { describe, expect, test } from "vite-plus/test";

import { describeLibraryOwner } from "./owner-description.ts";

describe("describeLibraryOwner", () => {
  describe("a type that admits exactly the values written here", () => {
    const it = test.extend("description", () =>
      describeLibraryOwner(
        {
          packageName: "oxlint",
          typeName: "AllowWarnDeny",
          declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
          values: ["error", "warn", "off"],
          admitsUnnamedValues: false,
        },
        ["error", "warn", "off"],
      ));

    it("is named without asking for narrowing", ({ description }) => {
      expect(description).toBe("AllowWarnDeny from oxlint");
    });
  });

  describe("a type that admits more values than are written here", () => {
    const it = test.extend("description", () =>
      describeLibraryOwner(
        {
          packageName: "oxlint",
          typeName: "AllowWarnDeny",
          declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
          values: ["allow", "deny", "error", "off", "warn"],
          admitsUnnamedValues: false,
        },
        ["error", "warn", "off"],
      ));

    it("names the ones it admits beyond these", ({ description }) => {
      expect(description).toBe(
        'AllowWarnDeny from oxlint (which also admits "allow" | "deny", so narrow it)',
      );
    });
  });

  describe("a type that admits values outside its literals", () => {
    const it = test.extend("description", () =>
      describeLibraryOwner(
        {
          packageName: "oxlint",
          typeName: "AllowWarnDeny",
          declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
          values: ["error", "warn", "off"],
          admitsUnnamedValues: true,
        },
        ["error", "warn", "off"],
      ));

    it("says so instead of listing them", ({ description }) => {
      expect(description).toBe(
        "AllowWarnDeny from oxlint (which also admits values that are not spelled out as literals, so narrow it)",
      );
    });
  });

  describe("a type that is wider in both ways", () => {
    const it = test.extend("description", () =>
      describeLibraryOwner(
        {
          packageName: "oxlint",
          typeName: "AllowWarnDeny",
          declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
          values: ["allow", "deny", "error", "off", "warn"],
          admitsUnnamedValues: true,
        },
        ["error", "warn", "off"],
      ));

    it("names the extra literals and says the rest is open", ({ description }) => {
      expect(description).toBe(
        'AllowWarnDeny from oxlint (which also admits "allow" | "deny" and values that are not spelled out as literals, so narrow it)',
      );
    });
  });

  describe("a type that admits a number beside the text that looks the same", () => {
    const it = test.extend("description", () =>
      describeLibraryOwner(
        {
          packageName: "oxlint",
          typeName: "Digits",
          declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
          values: [1, 2, "2"],
          admitsUnnamedValues: false,
        },
        [1],
      ));

    it("keeps the two spellings apart", ({ description }) => {
      expect(description).toBe('Digits from oxlint (which also admits 2 | "2", so narrow it)');
    });
  });
});
