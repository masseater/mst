import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import { API } from "typescript/unstable/sync";
import { describe, expect, test, vi } from "vite-plus/test";

import { loadLibraryVocabulary } from "./harvester.ts";

vi.mock(import("typescript/unstable/sync"), { spy: true });

class FileSystemFailure extends Error {
  readonly code = "EACCES";
}

const FIXTURE_ROOT = join(tmpdir(), "dont-review-it-library-vocabulary-harvester");

describe("loadLibraryVocabulary", () => {
  describe("typed dependency declarations that export literal unions", () => {
    const it = test.extend("vocabulary", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "literal-unions");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "src"), { recursive: true });
      mkdirSync(join(packageDirectory, "node_modules", "fixture-types"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { "fixture-types": "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "fixture-types", "package.json"),
        JSON.stringify({ name: "fixture-types", version: "1.0.0", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "fixture-types", "index.d.ts"),
        [
          'export type Mixed = "on" | 2;',
          'type Severity = "error" | object;',
          "export { Severity as SeverityAlias };",
          "export type Scalar = string;",
          "export type Broken = Missing;",
          'export type ObjectOnly = { state: "ready" } | { state: "done" };',
          "",
        ].join("\n"),
        "utf8",
      );
      return loadLibraryVocabulary({
        filename: join(packageDirectory, "src", "subject.ts"),
        repositoryRoot: packageDirectory,
      });
    });

    it("are harvested as the vocabulary their declarations admit", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([
        {
          packageName: "fixture-types",
          typeName: "Mixed",
          declarationId: `${join(
            FIXTURE_ROOT.toLowerCase(),
            "literal-unions",
            "node_modules",
            "fixture-types",
            "index.d.ts",
          )}#3`,
          values: ["on", 2],
          admitsUnnamedValues: false,
        },
        {
          packageName: "fixture-types",
          typeName: "SeverityAlias",
          declarationId: `${join(
            FIXTURE_ROOT.toLowerCase(),
            "literal-unions",
            "node_modules",
            "fixture-types",
            "index.d.ts",
          )}#13`,
          values: ["error"],
          admitsUnnamedValues: true,
        },
      ]);
    });
  });

  describe("the TypeScript session used for a successful harvest", () => {
    const it = test.extend("closeTypeScript", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "closed-after-success");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "src"), { recursive: true });
      mkdirSync(join(packageDirectory, "node_modules", "fixture-types"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { "fixture-types": "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "fixture-types", "package.json"),
        JSON.stringify({ name: "fixture-types", version: "1.0.0", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "fixture-types", "index.d.ts"),
        'export type Mode = "fast" | "safe";\n',
        "utf8",
      );
      const closeSpy = vi.spyOn(API.prototype, "close");
      loadLibraryVocabulary({
        filename: join(packageDirectory, "src", "subject.ts"),
        repositoryRoot: packageDirectory,
      });
      return closeSpy;
    });

    it("is closed once", ({ closeTypeScript }) => {
      expect(closeTypeScript).toHaveBeenCalledTimes(1);
    });
  });

  describe("a package directory asked for its vocabulary twice", () => {
    const packageDirectory = join(FIXTURE_ROOT, "memoized");
    const it = test
      .extend("firstVocabulary", ({}, { onCleanup }) => {
        rmSync(packageDirectory, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(packageDirectory, { recursive: true, force: true });
        });
        mkdirSync(join(packageDirectory, "src"), { recursive: true });
        mkdirSync(join(packageDirectory, "node_modules", "fixture-types"), { recursive: true });
        writeFileSync(
          join(packageDirectory, "package.json"),
          JSON.stringify({ dependencies: { "fixture-types": "1.0.0" } }),
          "utf8",
        );
        writeFileSync(
          join(packageDirectory, "node_modules", "fixture-types", "package.json"),
          JSON.stringify({ name: "fixture-types", version: "1.0.0", types: "./index.d.ts" }),
          "utf8",
        );
        writeFileSync(
          join(packageDirectory, "node_modules", "fixture-types", "index.d.ts"),
          'export type Mode = "fast" | "safe";\n',
          "utf8",
        );
        return loadLibraryVocabulary({
          filename: join(packageDirectory, "src", "first.ts"),
          repositoryRoot: packageDirectory,
        });
      })
      .extend("secondVocabulary", ({ firstVocabulary }) => {
        const [libraryType] = firstVocabulary;
        if (libraryType === undefined) throw new Error("the first vocabulary must be present");
        return loadLibraryVocabulary({
          filename: join(packageDirectory, "src", `${libraryType.typeName}.ts`),
          repositoryRoot: packageDirectory,
        });
      });

    it("receives the first harvested index without rebuilding it", ({
      firstVocabulary,
      secondVocabulary,
    }) => {
      expect(secondVocabulary).toBe(firstVocabulary);
    });
  });

  describe("a source outside every package in the repository", () => {
    const it = test.extend("vocabulary", () =>
      loadLibraryVocabulary({
        filename: join(FIXTURE_ROOT, "outside", "subject.ts"),
        repositoryRoot: join(FIXTURE_ROOT, "outside"),
      }));

    it("has no library vocabulary", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([]);
    });
  });

  describe("a package that declares no typed dependency", () => {
    const it = test.extend("vocabulary", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "without-dependencies");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "src"), { recursive: true });
      writeFileSync(join(packageDirectory, "package.json"), "{}\n", "utf8");
      return loadLibraryVocabulary({
        filename: join(packageDirectory, "src", "subject.ts"),
        repositoryRoot: packageDirectory,
      });
    });

    it("has an empty vocabulary", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([]);
    });
  });

  describe("a package with no typed dependency entering TypeScript", () => {
    const it = test.extend("updateSnapshot", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "without-dependencies-session");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "src"), { recursive: true });
      writeFileSync(join(packageDirectory, "package.json"), "{}\n", "utf8");
      const updateSnapshotSpy = vi.spyOn(API.prototype, "updateSnapshot");
      loadLibraryVocabulary({
        filename: join(packageDirectory, "src", "subject.ts"),
        repositoryRoot: packageDirectory,
      });
      return updateSnapshotSpy;
    });

    it("is never attempted", ({ updateSnapshot }) => {
      expect(updateSnapshot).toHaveBeenCalledTimes(0);
    });
  });

  describe("dependency declarations whose TypeScript structures cannot be inspected", () => {
    const it = test.extend("vocabulary", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "uninspectable-declarations");
      rmSync(packageDirectory, { recursive: true, force: true });
      mkdirSync(join(packageDirectory, "src"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({
          dependencies: {
            "no-declaration": "1.0.0",
            "no-module": "1.0.0",
            "no-project": "1.0.0",
            "no-source": "1.0.0",
          },
        }),
        "utf8",
      );
      const declarationSources = {
        "no-declaration": 'export type MissingDeclaration = "fast" | "safe";\n',
        "no-module": 'declare type GlobalMode = "fast" | "safe";\n',
        "no-project": 'export type ProjectMode = "fast" | "safe";\n',
        "no-source": 'export type SourceMode = "fast" | "safe";\n',
      };
      for (const [dependencyName, declarationSource] of Object.entries(declarationSources)) {
        const dependencyDirectory = join(packageDirectory, "node_modules", dependencyName);
        mkdirSync(dependencyDirectory, { recursive: true });
        writeFileSync(
          join(dependencyDirectory, "package.json"),
          JSON.stringify({ name: dependencyName, version: "1.0.0", types: "./index.d.ts" }),
          "utf8",
        );
        writeFileSync(join(dependencyDirectory, "index.d.ts"), declarationSource, "utf8");
      }
      const noDeclarationPath = join(
        packageDirectory,
        "node_modules",
        "no-declaration",
        "index.d.ts",
      );
      const noModulePath = join(packageDirectory, "node_modules", "no-module", "index.d.ts");
      const noProjectPath = join(packageDirectory, "node_modules", "no-project", "index.d.ts");
      const noSourcePath = join(packageDirectory, "node_modules", "no-source", "index.d.ts");
      const preparatoryApi = new API({ cwd: packageDirectory });
      onCleanup(() => {
        preparatoryApi.close();
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      const snapshot = preparatoryApi.updateSnapshot({
        openFiles: [noDeclarationPath, noModulePath, noProjectPath, noSourcePath],
      });
      const getDefaultProjectForFile = snapshot.getDefaultProjectForFile.bind(snapshot);
      const noSourceProject = getDefaultProjectForFile(noSourcePath);
      if (noSourceProject === undefined) throw new Error("the no-source project must be present");
      const noDeclarationProject = getDefaultProjectForFile(noDeclarationPath);
      if (noDeclarationProject === undefined) {
        throw new Error("the no-declaration project must be present");
      }
      const noDeclarationSource = noDeclarationProject.program.getSourceFile(noDeclarationPath);
      if (noDeclarationSource === undefined) {
        throw new Error("the no-declaration source must be present");
      }
      const noDeclarationModule =
        noDeclarationProject.checker.getSymbolAtLocation(noDeclarationSource);
      if (noDeclarationModule === undefined) {
        throw new Error("the no-declaration module must be present");
      }
      const [exportedType] = noDeclarationProject.checker.getExportsOfModule(noDeclarationModule);
      if (exportedType === undefined) throw new Error("the exported type must be present");
      const declaredType = noDeclarationProject.checker.getDeclaredTypeOfSymbol(exportedType);
      const exportedTypeWithoutDeclarations = new Proxy(exportedType, {
        get(sourceSymbol, propertyName) {
          if (propertyName === "declarations") return [];
          if (propertyName === "flags") return sourceSymbol.flags;
          if (propertyName === "name") return sourceSymbol.name;
          return undefined;
        },
      });
      vi.spyOn(noDeclarationProject.checker, "getExportsOfModule").mockReturnValueOnce([
        exportedTypeWithoutDeclarations,
      ]);
      vi.spyOn(noDeclarationProject.checker, "getDeclaredTypeOfSymbol").mockReturnValueOnce(
        declaredType,
      );
      const noModuleProject = getDefaultProjectForFile(noModulePath);
      if (noModuleProject === undefined) throw new Error("the no-module project must be present");
      const noModuleSource = noModuleProject.program.getSourceFile(noModulePath);
      if (noModuleSource === undefined) throw new Error("the no-module source must be present");
      vi.spyOn(noSourceProject.program, "getSourceFile").mockImplementation((sourcePath) => {
        if (sourcePath === noDeclarationPath) return noDeclarationSource;
        if (sourcePath === noModulePath) return noModuleSource;
        return undefined;
      });
      vi.spyOn(snapshot, "getDefaultProjectForFile").mockImplementation((declarationsPath) => {
        if (declarationsPath === noDeclarationPath) return noDeclarationProject;
        if (declarationsPath === noModulePath) return noModuleProject;
        if (declarationsPath === noSourcePath) return noSourceProject;
        return undefined;
      });
      vi.spyOn(API.prototype, "updateSnapshot").mockReturnValueOnce(snapshot);
      return loadLibraryVocabulary({
        filename: join(packageDirectory, "src", "subject.ts"),
        repositoryRoot: packageDirectory,
      });
    });

    it("contribute no library vocabulary", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([]);
    });
  });

  describe("TypeScript refusing to read the dependency declarations", () => {
    const it = test.extend("vocabulary", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "environment-failure");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "src"), { recursive: true });
      mkdirSync(join(packageDirectory, "node_modules", "fixture-types"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { "fixture-types": "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "fixture-types", "package.json"),
        JSON.stringify({ name: "fixture-types", version: "1.0.0", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "fixture-types", "index.d.ts"),
        'export type Mode = "fast" | "safe";\n',
        "utf8",
      );
      vi.spyOn(API.prototype, "updateSnapshot").mockImplementationOnce(() => {
        throw new FileSystemFailure("the declarations cannot be read");
      });
      return loadLibraryVocabulary({
        filename: join(packageDirectory, "src", "subject.ts"),
        repositoryRoot: packageDirectory,
      });
    });

    it("is treated as an unavailable library vocabulary", ({ vocabulary }) => {
      expect(vocabulary).toStrictEqual([]);
    });
  });

  describe("TypeScript finding a defect in the dependency declarations", () => {
    const checkerFailure = new TypeError("checker failed");
    const it = test.extend("settlement", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "checker-failure");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "src"), { recursive: true });
      mkdirSync(join(packageDirectory, "node_modules", "fixture-types"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { "fixture-types": "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "fixture-types", "package.json"),
        JSON.stringify({ name: "fixture-types", version: "1.0.0", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "fixture-types", "index.d.ts"),
        'export type Mode = "fast" | "safe";\n',
        "utf8",
      );
      vi.spyOn(API.prototype, "updateSnapshot").mockImplementationOnce(() => {
        throw checkerFailure;
      });
      return attempt(() =>
        loadLibraryVocabulary({
          filename: join(packageDirectory, "src", "subject.ts"),
          repositoryRoot: packageDirectory,
        }),
      );
    });

    it("is surfaced whole", ({ settlement }) => {
      expect(settlement).toStrictEqual([checkerFailure, null]);
    });
  });
});
