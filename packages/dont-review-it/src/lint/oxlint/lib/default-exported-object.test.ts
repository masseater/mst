import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  defaultExportedObject,
  objectExpressionOf,
  type ProgramStatements,
} from "./default-exported-object.ts";

import type { ESTree } from "@oxlint/plugins";

const statementIn = (sourceText: string): ESTree.Statement => {
  const [statement] = parseSync("vite.config.ts", sourceText).program.body;
  if (statement === undefined) throw new Error(`nothing was parsed from: ${sourceText}`);
  return statement as ESTree.Statement;
};

const defaultValueIn = (sourceText: string): ESTree.ExportDefaultDeclaration["declaration"] => {
  const statement = statementIn(sourceText);
  if (statement.type !== "ExportDefaultDeclaration") {
    throw new Error(`no default export in: ${sourceText}`);
  }
  return statement.declaration;
};

const programOf = (...body: readonly ESTree.Statement[]): ProgramStatements => ({ body });

describe("objectExpressionOf", () => {
  test("an object expression is the object itself", () => {
    const object = defaultValueIn("export default { test: true };");
    expect(objectExpressionOf(object)).toBe(object);
  });

  test("the first argument is read through nested calls", () => {
    const wrapped = defaultValueIn(
      "export default defineConfig(withGitExcludes({ test: true }), ignored);",
    );
    expect(objectExpressionOf(wrapped)?.type).toBe("ObjectExpression");
  });

  test("a call without a first argument has no readable object", () => {
    expect(objectExpressionOf(defaultValueIn("export default defineConfig();"))).toBeNull();
  });

  test("a spread first argument has no single readable object", () => {
    expect(
      objectExpressionOf(defaultValueIn("export default defineConfig(...configurations);")),
    ).toBeNull();
  });

  test("a value that is neither an object nor a call has no readable object", () => {
    expect(objectExpressionOf(defaultValueIn("export default configuredElsewhere;"))).toBeNull();
  });
});

describe("defaultExportedObject", () => {
  test("the last default export is authoritative", () => {
    const earlier = statementIn("export default { chosen: false };");
    const unrelated = statementIn("export const marker = true;");
    const later = statementIn("export default { chosen: true };");
    if (
      later.type !== "ExportDefaultDeclaration" ||
      later.declaration.type !== "ObjectExpression"
    ) {
      throw new Error("the later statement is not an object default export");
    }

    expect(defaultExportedObject(programOf(earlier, unrelated, later))).toBe(later.declaration);
  });

  test("a program without a default export has no readable object", () => {
    expect(defaultExportedObject(programOf(statementIn("export const config = {};")))).toBeNull();
  });
});
