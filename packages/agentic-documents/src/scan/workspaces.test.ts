import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { collectWorkspaces } from "./workspaces.ts";

const DEFINITION_FILE = "pnpm-workspace.yaml";

const DEFINITION_FIELD = "packages";

describe("collectWorkspaces", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "workspaces-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [path, source] of Object.entries(files)) {
      const absolutePath = join(root, path);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, source, "utf8");
    }
    return root;
  };

  const collected = async (repositoryRoot: string) =>
    collectWorkspaces({
      repositoryRoot,
      definitionFile: DEFINITION_FILE,
      definitionField: DEFINITION_FIELD,
    });

  test("a pattern that ends in a star names every directory below it", async () => {
    const repositoryRoot = repositoryWith({
      [DEFINITION_FILE]: "packages:\n  - packages/*\n",
      "packages/session/package.json": '{"name":"session","description":"接続"}',
      "packages/user/package.json": '{"name":"user","description":"利用者"}',
    });

    expect((await collected(repositoryRoot)).entries).toStrictEqual([
      { directory: "packages/session", description: "接続" },
      { directory: "packages/user", description: "利用者" },
    ]);
  });

  test("a pattern that names one directory is taken as it is", async () => {
    const repositoryRoot = repositoryWith({
      [DEFINITION_FILE]: "packages:\n  - tools/build\n",
      "tools/build/package.json": '{"name":"build","description":"組み立て"}',
    });

    expect((await collected(repositoryRoot)).entries).toStrictEqual([
      { directory: "tools/build", description: "組み立て" },
    ]);
  });

  test("a workspace without a readable manifest, or without a description, is incomplete", async () => {
    const repositoryRoot = repositoryWith({
      [DEFINITION_FILE]: "packages:\n  - packages/*\n",
      "packages/session/package.json": '{"name":"session"}',
      "packages/user/README.md": "# user\n",
    });

    expect(
      (await collected(repositoryRoot)).incomplete.map((listed) => listed.directory),
    ).toStrictEqual(["packages/session", "packages/user"]);
  });

  test("a repository that declares no workspace definition names nothing", async () => {
    expect((await collected(repositoryWith({ "README.md": "# read me\n" }))).entries).toStrictEqual(
      [],
    );
  });

  test("a definition that is not a mapping names nothing", async () => {
    const repositoryRoot = repositoryWith({ [DEFINITION_FILE]: "- packages/*\n" });

    expect((await collected(repositoryRoot)).entries).toStrictEqual([]);
  });

  test("a definition that holds nothing at all names nothing", async () => {
    const repositoryRoot = repositoryWith({ [DEFINITION_FILE]: "\n" });

    expect((await collected(repositoryRoot)).entries).toStrictEqual([]);
  });

  test("a definition whose field is not a list names nothing", async () => {
    const repositoryRoot = repositoryWith({ [DEFINITION_FILE]: "packages: all\n" });

    expect((await collected(repositoryRoot)).entries).toStrictEqual([]);
  });

  test("a pattern that is not a word is left out of the list", async () => {
    const repositoryRoot = repositoryWith({
      [DEFINITION_FILE]: "packages:\n  - 1\n  - tools/build\n",
      "tools/build/package.json": '{"name":"build","description":"組み立て"}',
    });

    expect((await collected(repositoryRoot)).entries).toStrictEqual([
      { directory: "tools/build", description: "組み立て" },
    ]);
  });
});
