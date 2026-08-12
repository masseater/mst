import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { classModulesFor } from "./class-modules.ts";

const createFixtureDirectory = (): string => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "class-modules-")));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
};

const installedUnder = ({
  workspaceRoot,
  name,
  directory,
}: {
  readonly workspaceRoot: string;
  readonly name: string;
  readonly directory: string;
}): void => {
  const link = join(workspaceRoot, "node_modules", name);
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(join(workspaceRoot, directory), link, "dir");
};

describe("class-modules", () => {
  test("a class this file declares itself is read out of the text at hand", () => {
    expect(
      classModulesFor({
        file: "/repository/use.ts",
        source: "class Bag {}",
        workspaceRoot: "/repository",
        imported: null,
      }),
    ).toStrictEqual([{ path: "/repository/use.ts", source: "class Bag {}" }]);
  });

  test("a class taken from a neighbouring file is read out of that file", () => {
    const root = createFixtureDirectory();
    writeFileSync(join(root, "bag.ts"), "export class Bag {}", "utf8");

    expect(
      classModulesFor({
        file: join(root, "use.ts"),
        source: "import { Bag } from './bag.ts';",
        workspaceRoot: root,
        imported: { specifier: "./bag.ts", name: "Bag" },
      }),
    ).toStrictEqual([{ path: join(root, "bag.ts"), source: "export class Bag {}" }]);
  });

  test("a class taken from a package this repository does not carry is nowhere to read", () => {
    const root = createFixtureDirectory();

    expect(
      classModulesFor({
        file: join(root, "use.ts"),
        source: "import { Headers } from 'undici';",
        workspaceRoot: root,
        imported: { specifier: "undici", name: "Headers" },
      }),
    ).toStrictEqual([]);
  });

  test("a public entry a package declares but does not carry drops out of the modules to read", () => {
    const root = createFixtureDirectory();
    mkdirSync(join(root, "packages", "bag"), { recursive: true });
    writeFileSync(
      join(root, "packages", "bag", "package.json"),
      '{"name":"@fixture/bag","exports":{".":{"import":"./built.ts","default":"./bag.ts"}}}',
      "utf8",
    );
    writeFileSync(join(root, "packages", "bag", "bag.ts"), "export class Bag {}", "utf8");
    installedUnder({ workspaceRoot: root, name: "@fixture/bag", directory: "packages/bag" });

    expect(
      classModulesFor({
        file: join(root, "src", "use.ts"),
        source: "import { Bag } from '@fixture/bag';",
        workspaceRoot: root,
        imported: { specifier: "@fixture/bag", name: "Bag" },
      }),
    ).toStrictEqual([
      { path: join(root, "packages", "bag", "bag.ts"), source: "export class Bag {}" },
    ]);
  });
});
