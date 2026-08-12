import { describe, expect, test } from "vite-plus/test";

import { describeLibraryOwner } from "./owner-description.ts";

const it = test
  .extend("exactOwner", () =>
    describeLibraryOwner(
      {
        packageName: "oxlint",
        typeName: "AllowWarnDeny",
        declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
        values: ["error", "warn", "off"],
        admitsUnnamedValues: false,
      },
      ["error", "warn", "off"],
    ))
  .extend("widerLiteralOwner", () =>
    describeLibraryOwner(
      {
        packageName: "oxlint",
        typeName: "AllowWarnDeny",
        declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
        values: ["allow", "deny", "error", "off", "warn"],
        admitsUnnamedValues: false,
      },
      ["error", "warn", "off"],
    ),
  )
  .extend("openOwner", () =>
    describeLibraryOwner(
      {
        packageName: "oxlint",
        typeName: "AllowWarnDeny",
        declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
        values: ["error", "warn", "off"],
        admitsUnnamedValues: true,
      },
      ["error", "warn", "off"],
    ),
  )
  .extend("widerAndOpenOwner", () =>
    describeLibraryOwner(
      {
        packageName: "oxlint",
        typeName: "AllowWarnDeny",
        declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
        values: ["allow", "deny", "error", "off", "warn"],
        admitsUnnamedValues: true,
      },
      ["error", "warn", "off"],
    ),
  )
  .extend("numberedOwner", () =>
    describeLibraryOwner(
      {
        packageName: "oxlint",
        typeName: "Digits",
        declarationId: "oxlint/dist/index.d.ts#AllowWarnDeny",
        values: [1, 2, "2"],
        admitsUnnamedValues: false,
      },
      [1],
    ),
  );

describe("owner-description", () => {
  it("a type that admits exactly these values is named without asking for narrowing", ({
    exactOwner,
  }) => {
    expect(exactOwner).toBe("AllowWarnDeny from oxlint");
  });

  it("a type that admits more values names the ones it admits beyond these", ({
    widerLiteralOwner,
  }) => {
    expect(widerLiteralOwner).toBe(
      'AllowWarnDeny from oxlint (which also admits "allow" | "deny", so narrow it)',
    );
  });

  it("a type that admits values outside its literals says so instead of listing them", ({
    openOwner,
  }) => {
    expect(openOwner).toBe(
      "AllowWarnDeny from oxlint (which also admits values that are not spelled out as literals, so narrow it)",
    );
  });

  it("a type that is wider in both ways names the extra literals and says the rest is open", ({
    widerAndOpenOwner,
  }) => {
    expect(widerAndOpenOwner).toBe(
      'AllowWarnDeny from oxlint (which also admits "allow" | "deny" and values that are not spelled out as literals, so narrow it)',
    );
  });

  it("numbers keep their spelling apart from the text that looks the same", ({ numberedOwner }) => {
    expect(numberedOwner).toBe('Digits from oxlint (which also admits 2 | "2", so narrow it)');
  });
});
