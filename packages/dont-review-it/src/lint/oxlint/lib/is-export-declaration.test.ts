import { describe, expect, test } from "vite-plus/test";

import { isExportDeclaration } from "./is-export-declaration.ts";

describe("isExportDeclaration", () => {
  const it = test
    .extend("namedExportDeclaration", () => isExportDeclaration({ type: "ExportNamedDeclaration" }))
    .extend("defaultExportDeclaration", () =>
      isExportDeclaration({ type: "ExportDefaultDeclaration" }),
    )
    .extend("programDeclaration", () => isExportDeclaration({ type: "Program" }))
    .extend("absentDeclaration", () => isExportDeclaration(null));

  it("accepts a named export declaration", ({ namedExportDeclaration }) => {
    expect(namedExportDeclaration).toBe(true);
  });

  it("accepts a default export declaration", ({ defaultExportDeclaration }) => {
    expect(defaultExportDeclaration).toBe(true);
  });

  it("rejects a program declaration", ({ programDeclaration }) => {
    expect(programDeclaration).toBe(false);
  });

  it("rejects an absent declaration", ({ absentDeclaration }) => {
    expect(absentDeclaration).toBe(false);
  });
});
