import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { classModulesFor } from "./class-modules.ts";

describe("classModulesFor", () => {
  const testInARepository = test.extend("root", ({}, { onCleanup }) => {
    const repositoryDirectory = realpathSync(mkdtempSync(join(tmpdir(), "class-modules-")));
    onCleanup(() => {
      rmSync(repositoryDirectory, { recursive: true, force: true });
    });
    return repositoryDirectory;
  });

  describe("a class this file declares itself", () => {
    const it = test.extend("modulesOfOwnClass", () =>
      classModulesFor({
        file: "/repository/use.ts",
        source: "class Bag {}",
        workspaceRoot: "/repository",
        imported: null,
      }));

    it("is read out of the text at hand", ({ modulesOfOwnClass }) => {
      expect(modulesOfOwnClass).toStrictEqual([
        { path: "/repository/use.ts", source: "class Bag {}" },
      ]);
    });
  });

  describe("a class taken from a neighbouring file", () => {
    const it = testInARepository.extend("modulesOfNeighbourClass", ({ root }) => {
      writeFileSync(join(root, "bag.ts"), "export class Bag {}", "utf8");
      return classModulesFor({
        file: join(root, "use.ts"),
        source: "import { Bag } from './bag.ts';",
        workspaceRoot: root,
        imported: { specifier: "./bag.ts", exported: "Bag" },
      });
    });

    it("is read out of that file", ({ modulesOfNeighbourClass, root }) => {
      expect(modulesOfNeighbourClass).toStrictEqual([
        { path: join(root, "bag.ts"), source: "export class Bag {}" },
      ]);
    });
  });

  describe("a class taken from a package this repository does not carry", () => {
    const it = testInARepository.extend("modulesOfAbsentPackageClass", ({ root }) =>
      classModulesFor({
        file: join(root, "use.ts"),
        source: "import { Headers } from 'undici';",
        workspaceRoot: root,
        imported: { specifier: "undici", exported: "Headers" },
      }),
    );

    it("is nowhere to read", ({ modulesOfAbsentPackageClass }) => {
      expect(modulesOfAbsentPackageClass).toStrictEqual([]);
    });
  });

  describe("a path that leads to no file", () => {
    const it = testInARepository.extend("modulesOfPackageEntryThatIsNotThere", ({ root }) => {
      mkdirSync(join(root, "packages", "bag"), { recursive: true });
      writeFileSync(
        join(root, "packages", "bag", "package.json"),
        '{ "name": "@fixture/bag", "exports": { ".": "./missing.ts" } }\n',
        "utf8",
      );
      mkdirSync(join(root, "node_modules", "@fixture"), { recursive: true });
      symlinkSync(
        join(root, "packages", "bag"),
        join(root, "node_modules", "@fixture", "bag"),
        "dir",
      );
      return classModulesFor({
        file: join(root, "use.ts"),
        source: "import { Bag } from '@fixture/bag';",
        workspaceRoot: root,
        imported: { specifier: "@fixture/bag", exported: "Bag" },
      });
    });

    it("drops out of the modules to read", ({ modulesOfPackageEntryThatIsNotThere }) => {
      expect(modulesOfPackageEntryThatIsNotThere).toStrictEqual([]);
    });
  });

  describe("a public entry a package declares but does not carry", () => {
    const it = testInARepository.extend("modulesOfPackageEntryPartlyCarried", ({ root }) => {
      mkdirSync(join(root, "packages", "bag"), { recursive: true });
      writeFileSync(
        join(root, "packages", "bag", "package.json"),
        '{"name":"@fixture/bag","exports":{".":{"import":"./built.ts","default":"./bag.ts"}}}',
        "utf8",
      );
      writeFileSync(join(root, "packages", "bag", "bag.ts"), "export class Bag {}", "utf8");
      mkdirSync(join(root, "node_modules", "@fixture"), { recursive: true });
      symlinkSync(
        join(root, "packages", "bag"),
        join(root, "node_modules", "@fixture", "bag"),
        "dir",
      );
      return classModulesFor({
        file: join(root, "src", "use.ts"),
        source: "import { Bag } from '@fixture/bag';",
        workspaceRoot: root,
        imported: { specifier: "@fixture/bag", exported: "Bag" },
      });
    });

    it("drops out of the modules to read", ({ modulesOfPackageEntryPartlyCarried, root }) => {
      expect(modulesOfPackageEntryPartlyCarried).toStrictEqual([
        { path: join(root, "packages", "bag", "bag.ts"), source: "export class Bag {}" },
      ]);
    });
  });
});
