import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { importedDeclarationOf, moduleDeclarationsOf } from "./module-declarations.ts";

import type { SpecStatement } from "./subject-expressions.ts";

const it = test
  .extend("namesAndKindsBoundInAModuleExportingAConstant", () =>
    [
      ...moduleDeclarationsOf(
        "shape.ts",
        parseSync("shape.ts", "export const ordered = (rows) => rows.sort();").program.body.map(
          (statement) => statement as SpecStatement,
        ),
      ).initializerByName,
    ].map(([name, bound]) => [name, bound.type]))
  .extend("namesAndKindsBoundInAModuleExportingAFunction", () =>
    [
      ...moduleDeclarationsOf(
        "shape.ts",
        parseSync(
          "shape.ts",
          "export function ordered(rows) {\n  return rows;\n}",
        ).program.body.map((statement) => statement as SpecStatement),
      ).initializerByName,
    ].map(([name, bound]) => [name, bound.type]),
  )
  .extend("namesAndKindsBoundByADeclarationWithoutAName", () =>
    [
      ...moduleDeclarationsOf(
        "shape.ts",
        parseSync("shape.ts", "export default function () {}").program.body.map(
          (statement) => statement as SpecStatement,
        ),
      ).initializerByName,
    ].map(([name, bound]) => [name, bound.type]),
  )
  .extend("namesAndKindsBoundByBindingsWithoutAnInitialiser", () =>
    [
      ...moduleDeclarationsOf(
        "shape.ts",
        parseSync(
          "shape.ts",
          "let ordered;\nconst [head] = rows;\ndeclare const listed: string;",
        ).program.body.map((statement) => statement as SpecStatement),
      ).initializerByName,
    ].map(([name, bound]) => [name, bound.type]),
  )
  .extend("originOfAnImportedName", () =>
    moduleDeclarationsOf(
      "spec.ts",
      parseSync(
        "spec.ts",
        'import { ordered as arranged } from "./shape.ts";\nimport widen from "./widen.ts";\n',
      ).program.body.map((statement) => statement as SpecStatement),
    ).importedByName.get("arranged"),
  )
  .extend("localBindingBehindAnExportedName", () =>
    moduleDeclarationsOf(
      "shape.ts",
      parseSync(
        "shape.ts",
        "const ordered = rows;\nexport { ordered as sorted };",
      ).program.body.map((statement) => statement as SpecStatement),
    ).localNameByExported.get("sorted"),
  )
  .extend("moduleBehindAForwardedName", () =>
    moduleDeclarationsOf(
      "index.ts",
      parseSync("index.ts", 'export { ordered } from "./shape.ts";').program.body.map(
        (statement) => statement as SpecStatement,
      ),
    ).forwardedByExported.get("ordered"),
  )
  .extend("declarationsOfAModuleForwardingWholesale", () =>
    moduleDeclarationsOf(
      "index.ts",
      parseSync(
        "index.ts",
        'export * from "./shape.ts";\nexport * as shape from "./shape.ts";',
      ).program.body.map((statement) => statement as SpecStatement),
    ),
  )
  .extend("declarationReachedThroughADependency", () => {
    const directory = join(tmpdir(), "dont-review-it-module-declarations", "dependency");
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
    return importedDeclarationOf({
      from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
      imported: { specifier: "es-toolkit", exported: "sortBy" },
      visited: new Set<string>(),
    });
  })
  .extend("declarationReachedThroughAModuleThatIsNotOnDisk", () => {
    const directory = join(tmpdir(), "dont-review-it-module-declarations", "absent");
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
    return importedDeclarationOf({
      from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
      imported: { specifier: "./absent.ts", exported: "ordered" },
      visited: new Set<string>(),
    });
  })
  .extend("declarationOfANameTheModuleNeverDeclares", () => {
    const directory = join(tmpdir(), "dont-review-it-module-declarations", "bare");
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "bare.ts"), "export const widen = (rows) => rows;\n");
    return importedDeclarationOf({
      from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
      imported: { specifier: "./bare.ts", exported: "ordered" },
      visited: new Set<string>(),
    });
  })
  .extend("readingOfANameDeclaredInTheImportedModule", () => {
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
  })
  .extend("kindBehindANameExportedUnderAnAlias", () => {
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
  })
  .extend("moduleBehindANameReExportedFromAnotherModule", () => {
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
  })
  .extend("moduleBehindANameThatArrivesByImportAndLeavesByExport", () => {
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
  })
  .extend("moduleBehindANameForwardedWholesale", () => {
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
  })
  .extend("declarationReachedThroughAForwardingCycle", () => {
    const directory = join(tmpdir(), "dont-review-it-module-declarations", "looping");
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "looping.ts"), 'export * from "./looping.ts";\n');
    return importedDeclarationOf({
      from: moduleDeclarationsOf(join(directory, "spec.ts"), []),
      imported: { specifier: "./looping.ts", exported: "ordered" },
      visited: new Set<string>(),
    });
  })
  .extend("kindBehindASpellingWrittenAsAStringInAnExportClause", () => {
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

describe("module declarations", () => {
  it("a module names the value each exported constant is bound to", ({
    namesAndKindsBoundInAModuleExportingAConstant,
  }) => {
    expect(namesAndKindsBoundInAModuleExportingAConstant).toStrictEqual([
      ["ordered", "ArrowFunctionExpression"],
    ]);
  });

  it("a module names the function each declaration introduces", ({
    namesAndKindsBoundInAModuleExportingAFunction,
  }) => {
    expect(namesAndKindsBoundInAModuleExportingAFunction).toStrictEqual([
      ["ordered", "FunctionDeclaration"],
    ]);
  });

  it("a declaration without a name is nothing this reading can look up", ({
    namesAndKindsBoundByADeclarationWithoutAName,
  }) => {
    expect(namesAndKindsBoundByADeclarationWithoutAName).toStrictEqual([]);
  });

  it("a binding written without an initialiser is nothing this reading can look up", ({
    namesAndKindsBoundByBindingsWithoutAnInitialiser,
  }) => {
    expect(namesAndKindsBoundByBindingsWithoutAnInitialiser).toStrictEqual([]);
  });

  it("a module names where each imported name comes from", ({ originOfAnImportedName }) => {
    expect(originOfAnImportedName).toStrictEqual({
      specifier: "./shape.ts",
      exported: "ordered",
    });
  });

  it("a module names the local binding behind each name it exports", ({
    localBindingBehindAnExportedName,
  }) => {
    expect(localBindingBehindAnExportedName).toBe("ordered");
  });

  it("a module names the module behind each name it forwards", ({ moduleBehindAForwardedName }) => {
    expect(moduleBehindAForwardedName).toStrictEqual({
      specifier: "./shape.ts",
      exported: "ordered",
    });
  });

  it("a module names every module it forwards wholesale", ({
    declarationsOfAModuleForwardingWholesale,
  }) => {
    expect(declarationsOfAModuleForwardingWholesale).toStrictEqual({
      filename: "index.ts",
      initializerByName: new Map(),
      importedByName: new Map(),
      localNameByExported: new Map(),
      forwardedByExported: new Map(),
      forwardedSpecifiers: ["./shape.ts"],
    });
  });

  it("a name reached through a dependency is judged by its spelling alone", ({
    declarationReachedThroughADependency,
  }) => {
    expect(declarationReachedThroughADependency).toBe(null);
  });

  it("a module that is not on disk hands back nothing to read", ({
    declarationReachedThroughAModuleThatIsNotOnDisk,
  }) => {
    expect(declarationReachedThroughAModuleThatIsNotOnDisk).toBe(null);
  });

  it("a name the module never declares hands back nothing to read", ({
    declarationOfANameTheModuleNeverDeclares,
  }) => {
    expect(declarationOfANameTheModuleNeverDeclares).toBe(null);
  });

  it("a name declared in the imported module resolves to what it is bound to", ({
    readingOfANameDeclaredInTheImportedModule,
  }) => {
    expect(readingOfANameDeclaredInTheImportedModule).toStrictEqual([
      {
        kind: "ArrowFunctionExpression",
        module: join(tmpdir(), "dont-review-it-module-declarations", "declared", "shape.ts"),
      },
    ]);
  });

  it("a name exported under an alias resolves to the binding behind the alias", ({
    kindBehindANameExportedUnderAnAlias,
  }) => {
    expect(kindBehindANameExportedUnderAnAlias).toStrictEqual(["ArrowFunctionExpression"]);
  });

  it("a name re-exported from another module is followed to that module", ({
    moduleBehindANameReExportedFromAnotherModule,
  }) => {
    expect(moduleBehindANameReExportedFromAnotherModule).toStrictEqual([
      join(tmpdir(), "dont-review-it-module-declarations", "re-exported", "shape.ts"),
    ]);
  });

  it("a name that arrives by import and leaves by export is followed to its source", ({
    moduleBehindANameThatArrivesByImportAndLeavesByExport,
  }) => {
    expect(moduleBehindANameThatArrivesByImportAndLeavesByExport).toStrictEqual([
      join(tmpdir(), "dont-review-it-module-declarations", "passed-on", "shape.ts"),
    ]);
  });

  it("a name forwarded wholesale is followed into the forwarded module", ({
    moduleBehindANameForwardedWholesale,
  }) => {
    expect(moduleBehindANameForwardedWholesale).toStrictEqual([
      join(tmpdir(), "dont-review-it-module-declarations", "barrel", "shape.ts"),
    ]);
  });

  it("a forwarding cycle stops at the module it has already read", ({
    declarationReachedThroughAForwardingCycle,
  }) => {
    expect(declarationReachedThroughAForwardingCycle).toBe(null);
  });

  it("a spelling written as a string in an export clause reads as the same name", ({
    kindBehindASpellingWrittenAsAStringInAnExportClause,
  }) => {
    expect(kindBehindASpellingWrittenAsAStringInAnExportClause).toStrictEqual([
      "ArrowFunctionExpression",
    ]);
  });
});
