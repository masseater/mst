import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { defaultExportedObject, objectExpressionOf } from "./default-exported-object.ts";

import type { ESTree } from "@oxlint/plugins";

describe("objectExpressionOf", () => {
  const it = test
    .extend("unwrappedObjectIdentity", () => {
      const [statement] = parseSync("vite.config.ts", "export default { test: true };").program
        .body;
      if (statement?.type !== "ExportDefaultDeclaration") {
        throw new Error("expected a default export");
      }
      const defaultDeclaration =
        statement.declaration as ESTree.ExportDefaultDeclaration["declaration"];
      return objectExpressionOf(defaultDeclaration) === defaultDeclaration;
    })
    .extend("nestedCallObjectType", () => {
      const [statement] = parseSync(
        "vite.config.ts",
        "export default defineConfig(withGitExcludes({ test: true }), ignored);",
      ).program.body;
      if (statement?.type !== "ExportDefaultDeclaration") {
        throw new Error("expected a default export");
      }
      const defaultDeclaration =
        statement.declaration as ESTree.ExportDefaultDeclaration["declaration"];
      return objectExpressionOf(defaultDeclaration)?.type;
    })
    .extend("argumentlessCallObject", () => {
      const [statement] = parseSync("vite.config.ts", "export default defineConfig();").program
        .body;
      if (statement?.type !== "ExportDefaultDeclaration") {
        throw new Error("expected a default export");
      }
      return objectExpressionOf(
        statement.declaration as ESTree.ExportDefaultDeclaration["declaration"],
      );
    })
    .extend("spreadCallObject", () => {
      const [statement] = parseSync(
        "vite.config.ts",
        "export default defineConfig(...configurations);",
      ).program.body;
      if (statement?.type !== "ExportDefaultDeclaration") {
        throw new Error("expected a default export");
      }
      return objectExpressionOf(
        statement.declaration as ESTree.ExportDefaultDeclaration["declaration"],
      );
    })
    .extend("identifierObject", () => {
      const [statement] = parseSync("vite.config.ts", "export default configuredElsewhere;").program
        .body;
      if (statement?.type !== "ExportDefaultDeclaration") {
        throw new Error("expected a default export");
      }
      return objectExpressionOf(
        statement.declaration as ESTree.ExportDefaultDeclaration["declaration"],
      );
    });

  it("returns an object expression unchanged", ({ unwrappedObjectIdentity }) => {
    expect(unwrappedObjectIdentity).toBe(true);
  });

  it("reads the first argument through nested calls", ({ nestedCallObjectType }) => {
    expect(nestedCallObjectType).toBe("ObjectExpression");
  });

  it("returns no object for a call without a first argument", ({ argumentlessCallObject }) => {
    expect(argumentlessCallObject).toBe(null);
  });

  it("returns no object for a spread first argument", ({ spreadCallObject }) => {
    expect(spreadCallObject).toBe(null);
  });

  it("returns no object for a value that is neither an object nor a call", ({
    identifierObject,
  }) => {
    expect(identifierObject).toBe(null);
  });
});

describe("defaultExportedObject", () => {
  const it = test
    .extend("lastDefaultExportIdentity", () => {
      const [earlier] = parseSync("vite.config.ts", "export default { chosen: false };").program
        .body;
      const [unrelated] = parseSync("vite.config.ts", "export const marker = true;").program.body;
      const [later] = parseSync("vite.config.ts", "export default { chosen: true };").program.body;
      if (
        earlier === undefined ||
        unrelated === undefined ||
        later?.type !== "ExportDefaultDeclaration" ||
        later.declaration.type !== "ObjectExpression"
      ) {
        throw new Error("expected parsed statements and an object default export");
      }
      const selected = defaultExportedObject({
        body: [earlier, unrelated, later] as ESTree.Statement[],
      });
      return selected === later.declaration;
    })
    .extend("programWithoutDefaultObject", () => {
      const [statement] = parseSync("vite.config.ts", "export const config = {};").program.body;
      if (statement === undefined) throw new Error("expected a parsed statement");
      return defaultExportedObject({ body: [statement as ESTree.Statement] });
    });

  it("uses the last default export as authoritative", ({ lastDefaultExportIdentity }) => {
    expect(lastDefaultExportIdentity).toBe(true);
  });

  it("returns no object for a program without a default export", ({
    programWithoutDefaultObject,
  }) => {
    expect(programWithoutDefaultObject).toBe(null);
  });
});
