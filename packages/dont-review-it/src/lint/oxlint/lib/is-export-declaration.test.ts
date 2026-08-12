import { describe, expect, test } from "vite-plus/test";

import { isExportDeclaration } from "./is-export-declaration.ts";

describe("isExportDeclaration", () => {
  test("it accepts both export declaration forms and rejects every other parent", () => {
    expect(isExportDeclaration({ type: "ExportNamedDeclaration" })).toBe(true);
    expect(isExportDeclaration({ type: "ExportDefaultDeclaration" })).toBe(true);
    expect(isExportDeclaration({ type: "Program" })).toBe(false);
    expect(isExportDeclaration(null)).toBe(false);
  });
});
