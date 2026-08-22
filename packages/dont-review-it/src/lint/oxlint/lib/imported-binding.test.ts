import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { collectBinding, isReferenceTo, newBinding } from "./imported-binding.ts";

import type { ESTree } from "@oxlint/plugins";

describe("imported binding", () => {
  const it = test
    .extend("namedValueAliasReference", () => {
      const importedBinding = { exportedName: "oxlint", binding: newBinding() };
      const importProgram = parseSync(
        "config.ts",
        `import { oxlint as presetConfig } from "preset";`,
        { preserveParens: false },
      ).program;
      for (const statement of importProgram.body) {
        if (statement.type === "ImportDeclaration" && statement.source.value === "preset") {
          collectBinding(statement as ESTree.ImportDeclaration, importedBinding);
        }
      }
      const [statement] = parseSync("config.ts", "presetConfig;", {
        preserveParens: false,
      }).program.body;
      if (statement?.type !== "ExpressionStatement") throw new Error("expected an expression");
      return isReferenceTo(statement.expression as ESTree.Expression, importedBinding);
    })
    .extend("namespaceMemberReference", () => {
      const importedBinding = { exportedName: "oxlint", binding: newBinding() };
      const importProgram = parseSync("config.ts", `import * as preset from "preset";`, {
        preserveParens: false,
      }).program;
      for (const statement of importProgram.body) {
        if (statement.type === "ImportDeclaration" && statement.source.value === "preset") {
          collectBinding(statement as ESTree.ImportDeclaration, importedBinding);
        }
      }
      const [statement] = parseSync("config.ts", "preset.oxlint;", {
        preserveParens: false,
      }).program.body;
      if (statement?.type !== "ExpressionStatement") throw new Error("expected an expression");
      return isReferenceTo(statement.expression as ESTree.Expression, importedBinding);
    })
    .extend("computedNamespaceMemberReference", () => {
      const importedBinding = { exportedName: "oxlint", binding: newBinding() };
      const importProgram = parseSync("config.ts", `import * as preset from "preset";`, {
        preserveParens: false,
      }).program;
      for (const statement of importProgram.body) {
        if (statement.type === "ImportDeclaration" && statement.source.value === "preset") {
          collectBinding(statement as ESTree.ImportDeclaration, importedBinding);
        }
      }
      const [statement] = parseSync("config.ts", `preset["oxlint"];`, {
        preserveParens: false,
      }).program.body;
      if (statement?.type !== "ExpressionStatement") throw new Error("expected an expression");
      return isReferenceTo(statement.expression as ESTree.Expression, importedBinding);
    })
    .extend("typeOnlyImportReference", () => {
      const importedBinding = { exportedName: "oxlint", binding: newBinding() };
      const importProgram = parseSync("config.ts", `import type { oxlint } from "preset";`, {
        preserveParens: false,
      }).program;
      for (const statement of importProgram.body) {
        if (statement.type === "ImportDeclaration" && statement.source.value === "preset") {
          collectBinding(statement as ESTree.ImportDeclaration, importedBinding);
        }
      }
      const [statement] = parseSync("config.ts", "oxlint;", {
        preserveParens: false,
      }).program.body;
      if (statement?.type !== "ExpressionStatement") throw new Error("expected an expression");
      return isReferenceTo(statement.expression as ESTree.Expression, importedBinding);
    })
    .extend("inlineTypeOnlyImportReference", () => {
      const importedBinding = { exportedName: "oxlint", binding: newBinding() };
      const importProgram = parseSync("config.ts", `import { type oxlint } from "preset";`, {
        preserveParens: false,
      }).program;
      for (const statement of importProgram.body) {
        if (statement.type === "ImportDeclaration" && statement.source.value === "preset") {
          collectBinding(statement as ESTree.ImportDeclaration, importedBinding);
        }
      }
      const [statement] = parseSync("config.ts", "oxlint;", {
        preserveParens: false,
      }).program.body;
      if (statement?.type !== "ExpressionStatement") throw new Error("expected an expression");
      return isReferenceTo(statement.expression as ESTree.Expression, importedBinding);
    });

  it("recognizes a named value import through its local alias", ({ namedValueAliasReference }) => {
    expect(namedValueAliasReference).toBe(true);
  });

  it("recognizes an uncomputed member of a namespace value import", ({
    namespaceMemberReference,
  }) => {
    expect(namespaceMemberReference).toBe(true);
  });

  it("rejects a computed member of a namespace import", ({ computedNamespaceMemberReference }) => {
    expect(computedNamespaceMemberReference).toBe(false);
  });

  it("does not collect a declaration imported only as a type", ({ typeOnlyImportReference }) => {
    expect(typeOnlyImportReference).toBe(false);
  });

  it("does not collect an inline type-only specifier", ({ inlineTypeOnlyImportReference }) => {
    expect(inlineTypeOnlyImportReference).toBe(false);
  });
});
