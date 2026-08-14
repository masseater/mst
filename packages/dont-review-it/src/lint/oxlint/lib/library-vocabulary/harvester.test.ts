import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import { API } from "typescript/unstable/sync";
import { describe, expect, test } from "vite-plus/test";

import { createLibraryVocabularyLoader } from "./harvester.ts";

const FIXTURE_ROOT = join(tmpdir(), "dont-review-it-library-vocabulary-harvester");

class RuntimeRefusal extends Error {
  constructor(readonly code: string) {
    super("the runtime refused");
  }
}

describe("createLibraryVocabularyLoader", () => {
  describe("a dependency exporting a union of string literals", () => {
    const it = test.extend("theVocabularyOfTheLiteralUnion", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "literal-union");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "palette"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "holder", dependencies: { palette: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "package.json"),
        JSON.stringify({ name: "palette", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "index.d.ts"),
        'export type Shade = "dark" | "light";\n',
        "utf8",
      );
      return createLibraryVocabularyLoader({
        openApi: (directory) => new API({ cwd: directory }),
      })({
        filename: join(packageDirectory, "src", "reader.ts"),
        repositoryRoot: FIXTURE_ROOT,
      });
    });

    it("becomes an owner of the values it names", ({ theVocabularyOfTheLiteralUnion }) => {
      expect(theVocabularyOfTheLiteralUnion).toStrictEqual([
        {
          packageName: "palette",
          typeName: "Shade",
          declarationId: `${join(FIXTURE_ROOT, "literal-union", "node_modules", "palette", "index.d.ts").toLowerCase()}#3`,
          values: ["dark", "light"],
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("a dependency whose exported types admit values it does not name", () => {
    const it = test.extend("theVocabularyOfTheWidenedUnion", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "widened-union");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "palette"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "holder", dependencies: { palette: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "package.json"),
        JSON.stringify({ name: "palette", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "index.d.ts"),
        'export type Shade = "dark" | (string & {});\nexport type Plain = string;\nexport type Widths = string | number;\n',
        "utf8",
      );
      return createLibraryVocabularyLoader({
        openApi: (directory) => new API({ cwd: directory }),
      })({
        filename: join(packageDirectory, "src", "reader.ts"),
        repositoryRoot: FIXTURE_ROOT,
      });
    });

    it("keeps only the type that names values, and records that others pass", ({
      theVocabularyOfTheWidenedUnion,
    }) => {
      expect(theVocabularyOfTheWidenedUnion).toStrictEqual([
        {
          packageName: "palette",
          typeName: "Shade",
          declarationId: `${join(FIXTURE_ROOT, "widened-union", "node_modules", "palette", "index.d.ts").toLowerCase()}#3`,
          values: ["dark"],
          admitsUnnamedValues: true,
        },
      ]);
    });
  });

  describe("a dependency re-exporting a vocabulary declared beside it", () => {
    const it = test.extend("theVocabularyOfTheReExport", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "re-export");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "palette"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "holder", dependencies: { palette: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "package.json"),
        JSON.stringify({ name: "palette", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "tone.d.ts"),
        'export type Tone = "cool" | "warm";\n',
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "index.d.ts"),
        'export type { Tone } from "./tone";\n',
        "utf8",
      );
      return createLibraryVocabularyLoader({
        openApi: (directory) => new API({ cwd: directory }),
      })({
        filename: join(packageDirectory, "src", "reader.ts"),
        repositoryRoot: FIXTURE_ROOT,
      });
    });

    it("is read through to the declaration it points at", ({ theVocabularyOfTheReExport }) => {
      expect(theVocabularyOfTheReExport).toStrictEqual([
        {
          packageName: "palette",
          typeName: "Tone",
          declarationId: `${join(FIXTURE_ROOT, "re-export", "node_modules", "palette", "tone.d.ts").toLowerCase()}#3`,
          values: ["cool", "warm"],
          admitsUnnamedValues: false,
        },
      ]);
    });
  });

  describe("a package that declares no dependencies", () => {
    const it = test.extend("theVocabularyOfTheLonePackage", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "no-dependencies");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(packageDirectory, { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "alone" }),
        "utf8",
      );
      return createLibraryVocabularyLoader({
        openApi: (directory) => new API({ cwd: directory }),
      })({
        filename: join(packageDirectory, "src", "reader.ts"),
        repositoryRoot: FIXTURE_ROOT,
      });
    });

    it("has no vocabulary to offer", ({ theVocabularyOfTheLonePackage }) => {
      expect(theVocabularyOfTheLonePackage).toStrictEqual([]);
    });
  });

  describe("a file that no manifest governs", () => {
    const it = test.extend("theVocabularyOfTheUngovernedFile", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "no-manifest");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(packageDirectory, { recursive: true });
      return createLibraryVocabularyLoader({
        openApi: (directory) => new API({ cwd: directory }),
      })({
        filename: join(packageDirectory, "reader.ts"),
        repositoryRoot: packageDirectory,
      });
    });

    it("has no vocabulary to offer", ({ theVocabularyOfTheUngovernedFile }) => {
      expect(theVocabularyOfTheUngovernedFile).toStrictEqual([]);
    });
  });

  describe("declarations that declare nothing the outside can import", () => {
    const it = test.extend("theVocabularyOfTheScriptDeclarations", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "script-declarations");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "palette"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "holder", dependencies: { palette: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "package.json"),
        JSON.stringify({ name: "palette", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "index.d.ts"),
        'declare const shade: "dark" | "light";\n',
        "utf8",
      );
      return createLibraryVocabularyLoader({
        openApi: (directory) => new API({ cwd: directory }),
      })({
        filename: join(packageDirectory, "src", "reader.ts"),
        repositoryRoot: FIXTURE_ROOT,
      });
    });

    it("offer no vocabulary", ({ theVocabularyOfTheScriptDeclarations }) => {
      expect(theVocabularyOfTheScriptDeclarations).toStrictEqual([]);
    });
  });

  describe("declarations the runtime will not read", () => {
    const it = test.extend("theVocabularyOfTheUnreadableDeclarations", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "unreadable-declarations");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        chmodSync(join(packageDirectory, "node_modules", "palette", "index.d.ts"), 0o644);
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "palette"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "holder", dependencies: { palette: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "package.json"),
        JSON.stringify({ name: "palette", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "index.d.ts"),
        'export type Shade = "dark" | "light";\n',
        "utf8",
      );
      chmodSync(join(packageDirectory, "node_modules", "palette", "index.d.ts"), 0o000);
      return createLibraryVocabularyLoader({
        openApi: (directory) => new API({ cwd: directory }),
      })({
        filename: join(packageDirectory, "src", "reader.ts"),
        repositoryRoot: FIXTURE_ROOT,
      });
    });

    it("offer no vocabulary", ({ theVocabularyOfTheUnreadableDeclarations }) => {
      expect(theVocabularyOfTheUnreadableDeclarations).toStrictEqual([]);
    });
  });

  describe("a type checker the environment refuses to open", () => {
    const it = test.extend("theVocabularyAfterTheEnvironmentRefusal", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "environment-refusal");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "palette"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "holder", dependencies: { palette: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "package.json"),
        JSON.stringify({ name: "palette", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "index.d.ts"),
        'export type Shade = "dark" | "light";\n',
        "utf8",
      );
      return createLibraryVocabularyLoader({
        openApi: () => {
          throw new RuntimeRefusal("EACCES");
        },
      })({
        filename: join(packageDirectory, "src", "reader.ts"),
        repositoryRoot: FIXTURE_ROOT,
      });
    });

    it("leaves the vocabulary empty instead of stopping the lint run", ({
      theVocabularyAfterTheEnvironmentRefusal,
    }) => {
      expect(theVocabularyAfterTheEnvironmentRefusal).toStrictEqual([]);
    });
  });

  describe("a type checker that fails for a reason the environment does not name", () => {
    const it = test.extend("theFailureTheHarvestHandsBack", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "unnamed-failure");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "palette"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "holder", dependencies: { palette: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "package.json"),
        JSON.stringify({ name: "palette", types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "palette", "index.d.ts"),
        'export type Shade = "dark" | "light";\n',
        "utf8",
      );
      const [failure] = attempt(() =>
        createLibraryVocabularyLoader({
          openApi: () => {
            throw new TypeError("the type checker gave up");
          },
        })({
          filename: join(packageDirectory, "src", "reader.ts"),
          repositoryRoot: FIXTURE_ROOT,
        }),
      );
      return failure;
    });

    it("hands the failure to the caller unchanged", ({ theFailureTheHarvestHandsBack }) => {
      expect(theFailureTheHarvestHandsBack).toStrictEqual(
        new TypeError("the type checker gave up"),
      );
    });
  });
});
