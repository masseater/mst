import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { classModulesFor } from "./class-modules.ts";

const it = test
  .extend("root", ({}, { onCleanup }) => {
    const created = realpathSync(mkdtempSync(join(tmpdir(), "class-modules-")));
    onCleanup(() => {
      rmSync(created, { recursive: true, force: true });
    });
    return created;
  })
  .extend("modulesOfOwnClass", () =>
    classModulesFor({
      file: "/repository/use.ts",
      source: "class Bag {}",
      workspaceRoot: "/repository",
      imported: null,
    }),
  )
  .extend("modulesOfNeighbourClass", ({ root }) => {
    writeFileSync(join(root, "bag.ts"), "export class Bag {}", "utf8");
    return classModulesFor({
      file: join(root, "use.ts"),
      source: "import { Bag } from './bag.ts';",
      workspaceRoot: root,
      imported: { specifier: "./bag.ts", exported: "Bag" },
    });
  })
  .extend("modulesOfAbsentPackageClass", ({ root }) =>
    classModulesFor({
      file: join(root, "use.ts"),
      source: "import { Headers } from 'undici';",
      workspaceRoot: root,
      imported: { specifier: "undici", exported: "Headers" },
    }),
  )
  .extend("modulesOfPackageEntryThatIsNotThere", ({ root }) => {
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

describe("class-modules", () => {
  it("a class this file declares itself is read out of the text at hand", ({
    modulesOfOwnClass,
  }) => {
    expect(modulesOfOwnClass).toStrictEqual([
      { path: "/repository/use.ts", source: "class Bag {}" },
    ]);
  });

  it("a class taken from a neighbouring file is read out of that file", ({
    modulesOfNeighbourClass,
    root,
  }) => {
    expect(modulesOfNeighbourClass).toStrictEqual([
      { path: join(root, "bag.ts"), source: "export class Bag {}" },
    ]);
  });

  it("a class taken from a package this repository does not carry is nowhere to read", ({
    modulesOfAbsentPackageClass,
  }) => {
    expect(modulesOfAbsentPackageClass).toStrictEqual([]);
  });

  it("a path that leads to no file drops out of the modules to read", ({
    modulesOfPackageEntryThatIsNotThere,
  }) => {
    expect(modulesOfPackageEntryThatIsNotThere).toStrictEqual([]);
  });
});
