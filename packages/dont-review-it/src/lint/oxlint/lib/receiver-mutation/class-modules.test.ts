import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { classModulesAt, classModulesFor } from "./class-modules.ts";

const createFixtureDirectory = (): string => {
  const root = mkdtempSync(join(tmpdir(), "class-modules-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
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

  test("a path that leads to no file drops out of the modules to read", () => {
    const root = createFixtureDirectory();
    writeFileSync(join(root, "bag.ts"), "export class Bag {}", "utf8");

    expect(classModulesAt([join(root, "gone.ts"), join(root, "bag.ts")])).toStrictEqual([
      { path: join(root, "bag.ts"), source: "export class Bag {}" },
    ]);
  });
});
