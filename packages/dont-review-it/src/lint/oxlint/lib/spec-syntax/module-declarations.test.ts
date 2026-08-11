import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  importedDeclarationOf,
  moduleDeclarationsOf,
  type ModuleDeclarations,
} from "./module-declarations.ts";

import type { SpecStatement } from "./subject-expressions.ts";

const fixtureDir = join(tmpdir(), "dont-review-it-module-declarations");
rmSync(fixtureDir, { recursive: true, force: true });
mkdirSync(fixtureDir, { recursive: true });

const writeModule = (name: string, source: string): string => {
  const path = join(fixtureDir, name);
  writeFileSync(path, source);
  return path;
};

const declarationsOf = (path: string, source: string): ModuleDeclarations =>
  moduleDeclarationsOf(
    path,
    parseSync(path, source).program.body.map((statement) => statement as SpecStatement),
  );

const declaredFrom = (specifier: string, exported: string) =>
  importedDeclarationOf({
    from: declarationsOf(join(fixtureDir, "spec.ts"), ""),
    imported: { specifier, exported },
    visited: new Set<string>(),
  });
describe("module declarations", () => {
  test("a module names the value each exported constant is bound to", () => {
    const declared = declarationsOf("shape.ts", "export const ordered = (rows) => rows.sort();");

    expect(declared.initializerByName.get("ordered")?.type).toBe("ArrowFunctionExpression");
  });

  test("a module names the function each declaration introduces", () => {
    const declared = declarationsOf(
      "shape.ts",
      "export function ordered(rows) {\n  return rows;\n}",
    );

    expect(declared.initializerByName.get("ordered")?.type).toBe("FunctionDeclaration");
  });

  test("a declaration without a name is nothing this reading can look up", () => {
    const declared = declarationsOf("shape.ts", "export default function () {}");

    expect(declared.initializerByName.size).toBe(0);
  });

  test("a binding written without an initialiser is nothing this reading can look up", () => {
    const declared = declarationsOf(
      "shape.ts",
      "let ordered;\nconst [head] = rows;\ndeclare const listed: string;",
    );

    expect(declared.initializerByName.size).toBe(0);
  });

  test("a module names where each imported name comes from", () => {
    const declared = declarationsOf(
      "spec.ts",
      'import { ordered as arranged } from "./shape.ts";\nimport widen from "./widen.ts";\n',
    );

    expect(declared.importedByName.get("arranged")).toStrictEqual({
      specifier: "./shape.ts",
      exported: "ordered",
    });
  });

  test("a module names the local binding behind each name it exports", () => {
    const declared = declarationsOf(
      "shape.ts",
      "const ordered = rows;\nexport { ordered as sorted };",
    );

    expect(declared.localNameByExported.get("sorted")).toBe("ordered");
  });

  test("a module names the module behind each name it forwards", () => {
    const declared = declarationsOf("index.ts", 'export { ordered } from "./shape.ts";');

    expect(declared.forwardedByExported.get("ordered")).toStrictEqual({
      specifier: "./shape.ts",
      exported: "ordered",
    });
  });

  test("a module names every module it forwards wholesale", () => {
    const declared = declarationsOf(
      "index.ts",
      'export * from "./shape.ts";\nexport * as shape from "./shape.ts";',
    );

    expect(declared.forwardedSpecifiers).toStrictEqual(["./shape.ts"]);
  });

  test("a name reached through a dependency is judged by its spelling alone", () => {
    expect(declaredFrom("es-toolkit", "sortBy")).toBe(null);
  });

  test("a module that is not on disk hands back nothing to read", () => {
    expect(declaredFrom("./absent.ts", "ordered")).toBe(null);
  });

  test("a name the module never declares hands back nothing to read", () => {
    writeModule("bare.ts", "export const widen = (rows) => rows;\n");
    expect(declaredFrom("./bare.ts", "ordered")).toBe(null);
  });

  test("a name declared in the imported module resolves to what it is bound to", () => {
    const path = writeModule("shape.ts", "export const ordered = (rows) => rows.sort();\n");
    const found = declaredFrom("./shape.ts", "ordered");
    expect(`${found?.declared.type} ${found?.module.filename}`).toBe(
      `ArrowFunctionExpression ${path}`,
    );
  });

  test("a name exported under an alias resolves to the binding behind the alias", () => {
    writeModule(
      "aliased.ts",
      "const ordered = (rows) => rows.sort();\nexport { ordered as sorted };\n",
    );
    const found = declaredFrom("./aliased.ts", "sorted");
    expect(found?.declared.type).toBe("ArrowFunctionExpression");
  });

  test("a name re-exported from another module is followed to that module", () => {
    writeModule("shape.ts", "export const ordered = (rows) => rows.sort();\n");
    writeModule("re-exported.ts", 'export { ordered } from "./shape.ts";\n');
    const found = declaredFrom("./re-exported.ts", "ordered");
    expect(found?.module.filename).toBe(join(fixtureDir, "shape.ts"));
  });

  test("a name that arrives by import and leaves by export is followed to its source", () => {
    writeModule("shape.ts", "export const ordered = (rows) => rows.sort();\n");
    writeModule("passed-on.ts", 'import { ordered } from "./shape.ts";\nexport { ordered };\n');
    const found = declaredFrom("./passed-on.ts", "ordered");
    expect(found?.module.filename).toBe(join(fixtureDir, "shape.ts"));
  });

  test("a name forwarded wholesale is followed into the forwarded module", () => {
    writeModule("shape.ts", "export const ordered = (rows) => rows.sort();\n");
    writeModule("barrel.ts", 'export * from "./absent.ts";\nexport * from "./shape.ts";\n');
    const found = declaredFrom("./barrel.ts", "ordered");
    expect(found?.module.filename).toBe(join(fixtureDir, "shape.ts"));
  });

  test("a forwarding cycle stops at the module it has already read", () => {
    writeModule("looping.ts", 'export * from "./looping.ts";\n');
    expect(declaredFrom("./looping.ts", "ordered")).toBe(null);
  });

  test("a spelling written as a string in an export clause reads as the same name", () => {
    writeModule(
      "quoted.ts",
      'const ordered = (rows) => rows.sort();\nexport { ordered as "sorted" };\n',
    );
    const found = declaredFrom("./quoted.ts", "sorted");
    expect(found?.declared.type).toBe("ArrowFunctionExpression");
  });
});
