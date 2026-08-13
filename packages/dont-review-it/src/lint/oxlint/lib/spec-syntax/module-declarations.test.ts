import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { importedDeclarationOf, moduleDeclarationsOf } from "./module-declarations.ts";

import type { SpecStatement } from "./subject-expressions.ts";

describe("moduleDeclarationsOf", () => {
  describe("a module exporting a constant", () => {
    const it = test.extend("namesAndKindsBoundInAModuleExportingAConstant", () =>
      [
        ...moduleDeclarationsOf(
          "shape.ts",
          parseSync("shape.ts", "export const ordered = (rows) => rows.sort();").program.body.map(
            (statement) => statement as SpecStatement,
          ),
        ).initializerByName,
      ].map(([boundName, bound]) => [boundName, bound.type]));

    it("names the value that constant is bound to", ({
      namesAndKindsBoundInAModuleExportingAConstant,
    }) => {
      expect(namesAndKindsBoundInAModuleExportingAConstant).toStrictEqual([
        ["ordered", "ArrowFunctionExpression"],
      ]);
    });
  });

  describe("a module exporting a function", () => {
    const it = test.extend("namesAndKindsBoundInAModuleExportingAFunction", () =>
      [
        ...moduleDeclarationsOf(
          "shape.ts",
          parseSync(
            "shape.ts",
            "export function ordered(rows) {\n  return rows;\n}",
          ).program.body.map((statement) => statement as SpecStatement),
        ).initializerByName,
      ].map(([boundName, bound]) => [boundName, bound.type]));

    it("names the function that declaration introduces", ({
      namesAndKindsBoundInAModuleExportingAFunction,
    }) => {
      expect(namesAndKindsBoundInAModuleExportingAFunction).toStrictEqual([
        ["ordered", "FunctionDeclaration"],
      ]);
    });
  });

  describe("a declaration written without a name", () => {
    const it = test.extend("namesAndKindsBoundByADeclarationWithoutAName", () =>
      [
        ...moduleDeclarationsOf(
          "shape.ts",
          parseSync("shape.ts", "export default function () {}").program.body.map(
            (statement) => statement as SpecStatement,
          ),
        ).initializerByName,
      ].map(([boundName, bound]) => [boundName, bound.type]));

    it("is nothing this reading can look up", ({
      namesAndKindsBoundByADeclarationWithoutAName,
    }) => {
      expect(namesAndKindsBoundByADeclarationWithoutAName).toStrictEqual([]);
    });
  });

  describe("bindings written without an initialiser", () => {
    const it = test.extend("namesAndKindsBoundByBindingsWithoutAnInitialiser", () =>
      [
        ...moduleDeclarationsOf(
          "shape.ts",
          parseSync(
            "shape.ts",
            "let ordered;\nconst [head] = rows;\ndeclare const listed: string;",
          ).program.body.map((statement) => statement as SpecStatement),
        ).initializerByName,
      ].map(([boundName, bound]) => [boundName, bound.type]));

    it("are nothing this reading can look up", ({
      namesAndKindsBoundByBindingsWithoutAnInitialiser,
    }) => {
      expect(namesAndKindsBoundByBindingsWithoutAnInitialiser).toStrictEqual([]);
    });
  });

  describe("a name brought in under an alias", () => {
    const it = test.extend("originOfAnImportedName", () =>
      moduleDeclarationsOf(
        "spec.ts",
        parseSync(
          "spec.ts",
          'import { ordered as arranged } from "./shape.ts";\nimport widen from "./widen.ts";\n',
        ).program.body.map((statement) => statement as SpecStatement),
      ).importedByName.get("arranged"));

    it("is named together with where it comes from", ({ originOfAnImportedName }) => {
      expect(originOfAnImportedName).toStrictEqual({
        specifier: "./shape.ts",
        exported: "ordered",
      });
    });
  });

  describe("a name exported under another spelling", () => {
    const it = test.extend("localBindingBehindAnExportedName", () =>
      moduleDeclarationsOf(
        "shape.ts",
        parseSync(
          "shape.ts",
          "const ordered = rows;\nexport { ordered as sorted };",
        ).program.body.map((statement) => statement as SpecStatement),
      ).localNameByExported.get("sorted"));

    it("is named together with the local binding behind it", ({
      localBindingBehindAnExportedName,
    }) => {
      expect(localBindingBehindAnExportedName).toBe("ordered");
    });
  });

  describe("a name forwarded from another module", () => {
    const it = test.extend("moduleBehindAForwardedName", () =>
      moduleDeclarationsOf(
        "index.ts",
        parseSync("index.ts", 'export { ordered } from "./shape.ts";').program.body.map(
          (statement) => statement as SpecStatement,
        ),
      ).forwardedByExported.get("ordered"));

    it("is named together with the module behind it", ({ moduleBehindAForwardedName }) => {
      expect(moduleBehindAForwardedName).toStrictEqual({
        specifier: "./shape.ts",
        exported: "ordered",
      });
    });
  });

  describe("a module forwarding another module wholesale", () => {
    const it = test.extend("declarationsOfAModuleForwardingWholesale", () =>
      moduleDeclarationsOf(
        "index.ts",
        parseSync(
          "index.ts",
          'export * from "./shape.ts";\nexport * as shape from "./shape.ts";',
        ).program.body.map((statement) => statement as SpecStatement),
      ));

    it("names every module it forwards", ({ declarationsOfAModuleForwardingWholesale }) => {
      expect(declarationsOfAModuleForwardingWholesale).toStrictEqual({
        filename: "index.ts",
        initializerByName: new Map(),
        importedByName: new Map(),
        localNameByExported: new Map(),
        forwardedByExported: new Map(),
        forwardedSpecifiers: ["./shape.ts"],
      });
    });
  });
});

describe("importedDeclarationOf", () => {
  describe("a name reached through a dependency", () => {
    const it = test.extend("declarationReachedThroughADependency", () => {
      const directory = join(tmpdir(), "dont-review-it-module-declarations", "dependency");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      return importedDeclarationOf({
        from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
        imported: { specifier: "es-toolkit", exported: "sortBy" },
        visited: new Set<string>(),
      });
    });

    it("is judged by its spelling alone", ({ declarationReachedThroughADependency }) => {
      expect(declarationReachedThroughADependency).toBe(null);
    });
  });

  describe("a module that is not on disk", () => {
    const it = test.extend("declarationReachedThroughAModuleThatIsNotOnDisk", () => {
      const directory = join(tmpdir(), "dont-review-it-module-declarations", "absent");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      return importedDeclarationOf({
        from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
        imported: { specifier: "./absent.ts", exported: "ordered" },
        visited: new Set<string>(),
      });
    });

    it("hands back nothing to read", ({ declarationReachedThroughAModuleThatIsNotOnDisk }) => {
      expect(declarationReachedThroughAModuleThatIsNotOnDisk).toBe(null);
    });
  });

  describe("a name the module never declares", () => {
    const it = test.extend("declarationOfANameTheModuleNeverDeclares", () => {
      const directory = join(tmpdir(), "dont-review-it-module-declarations", "bare");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "bare.ts"), "export const widen = (rows) => rows;\n");
      return importedDeclarationOf({
        from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
        imported: { specifier: "./bare.ts", exported: "ordered" },
        visited: new Set<string>(),
      });
    });

    it("hands back nothing to read either", ({ declarationOfANameTheModuleNeverDeclares }) => {
      expect(declarationOfANameTheModuleNeverDeclares).toBe(null);
    });
  });

  describe("a name declared in the imported module", () => {
    const it = test.extend("readingOfANameDeclaredInTheImportedModule", () => {
      const directory = join(tmpdir(), "dont-review-it-module-declarations", "declared");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "shape.ts"), "export const ordered = (rows) => rows.sort();\n");
      return [
        importedDeclarationOf({
          from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
          imported: { specifier: "./shape.ts", exported: "ordered" },
          visited: new Set<string>(),
        }),
      ].map((found) => ({ kind: found?.declared.type, module: found?.module.filename }));
    });

    it("resolves to what it is bound to", ({ readingOfANameDeclaredInTheImportedModule }) => {
      expect(readingOfANameDeclaredInTheImportedModule).toStrictEqual([
        {
          kind: "ArrowFunctionExpression",
          module: join(tmpdir(), "dont-review-it-module-declarations", "declared", "shape.ts"),
        },
      ]);
    });
  });

  describe("a name exported under an alias", () => {
    const it = test.extend("kindBehindANameExportedUnderAnAlias", () => {
      const directory = join(tmpdir(), "dont-review-it-module-declarations", "aliased");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "aliased.ts"),
        "const ordered = (rows) => rows.sort();\nexport { ordered as sorted };\n",
      );
      return [
        importedDeclarationOf({
          from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
          imported: { specifier: "./aliased.ts", exported: "sorted" },
          visited: new Set<string>(),
        }),
      ].map((found) => found?.declared.type);
    });

    it("resolves to the binding behind the alias", ({ kindBehindANameExportedUnderAnAlias }) => {
      expect(kindBehindANameExportedUnderAnAlias).toStrictEqual(["ArrowFunctionExpression"]);
    });
  });

  describe("a name re-exported from another module", () => {
    const it = test.extend("moduleBehindANameReExportedFromAnotherModule", () => {
      const directory = join(tmpdir(), "dont-review-it-module-declarations", "re-exported");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "shape.ts"), "export const ordered = (rows) => rows.sort();\n");
      writeFileSync(join(directory, "re-exported.ts"), 'export { ordered } from "./shape.ts";\n');
      return [
        importedDeclarationOf({
          from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
          imported: { specifier: "./re-exported.ts", exported: "ordered" },
          visited: new Set<string>(),
        }),
      ].map((found) => found?.module.filename);
    });

    it("is followed to that module", ({ moduleBehindANameReExportedFromAnotherModule }) => {
      expect(moduleBehindANameReExportedFromAnotherModule).toStrictEqual([
        join(tmpdir(), "dont-review-it-module-declarations", "re-exported", "shape.ts"),
      ]);
    });
  });

  describe("a name that arrives by import and leaves by export", () => {
    const it = test.extend("moduleBehindANameThatArrivesByImportAndLeavesByExport", () => {
      const directory = join(tmpdir(), "dont-review-it-module-declarations", "passed-on");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "shape.ts"), "export const ordered = (rows) => rows.sort();\n");
      writeFileSync(
        join(directory, "passed-on.ts"),
        'import { ordered } from "./shape.ts";\nexport { ordered };\n',
      );
      return [
        importedDeclarationOf({
          from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
          imported: { specifier: "./passed-on.ts", exported: "ordered" },
          visited: new Set<string>(),
        }),
      ].map((found) => found?.module.filename);
    });

    it("is followed to its source", ({ moduleBehindANameThatArrivesByImportAndLeavesByExport }) => {
      expect(moduleBehindANameThatArrivesByImportAndLeavesByExport).toStrictEqual([
        join(tmpdir(), "dont-review-it-module-declarations", "passed-on", "shape.ts"),
      ]);
    });
  });

  describe("a name forwarded wholesale", () => {
    const it = test.extend("moduleBehindANameForwardedWholesale", () => {
      const directory = join(tmpdir(), "dont-review-it-module-declarations", "barrel");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "shape.ts"), "export const ordered = (rows) => rows.sort();\n");
      writeFileSync(
        join(directory, "barrel.ts"),
        'export * from "./absent.ts";\nexport * from "./shape.ts";\n',
      );
      return [
        importedDeclarationOf({
          from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
          imported: { specifier: "./barrel.ts", exported: "ordered" },
          visited: new Set<string>(),
        }),
      ].map((found) => found?.module.filename);
    });

    it("is followed into the forwarded module", ({ moduleBehindANameForwardedWholesale }) => {
      expect(moduleBehindANameForwardedWholesale).toStrictEqual([
        join(tmpdir(), "dont-review-it-module-declarations", "barrel", "shape.ts"),
      ]);
    });
  });

  describe("a forwarding cycle", () => {
    const it = test.extend("declarationReachedThroughAForwardingCycle", () => {
      const directory = join(tmpdir(), "dont-review-it-module-declarations", "looping");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "looping.ts"), 'export * from "./looping.ts";\n');
      return importedDeclarationOf({
        from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
        imported: { specifier: "./looping.ts", exported: "ordered" },
        visited: new Set<string>(),
      });
    });

    it("stops at the module it has already read", ({
      declarationReachedThroughAForwardingCycle,
    }) => {
      expect(declarationReachedThroughAForwardingCycle).toBe(null);
    });
  });

  describe("a spelling written as a string in an export clause", () => {
    const it = test.extend("kindBehindASpellingWrittenAsAStringInAnExportClause", () => {
      const directory = join(tmpdir(), "dont-review-it-module-declarations", "quoted");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "quoted.ts"),
        'const ordered = (rows) => rows.sort();\nexport { ordered as "sorted" };\n',
      );
      return [
        importedDeclarationOf({
          from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
          imported: { specifier: "./quoted.ts", exported: "sorted" },
          visited: new Set<string>(),
        }),
      ].map((found) => found?.declared.type);
    });

    it("reads as the same name", ({ kindBehindASpellingWrittenAsAStringInAnExportClause }) => {
      expect(kindBehindASpellingWrittenAsAStringInAnExportClause).toStrictEqual([
        "ArrowFunctionExpression",
      ]);
    });
  });
});
