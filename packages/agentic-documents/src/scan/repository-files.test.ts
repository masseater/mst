import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { findFilesNamed } from "./repository-files.ts";

describe("findFilesNamed", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "repository-files-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return root;
  };

  const named = async (repositoryRoot: string): Promise<readonly string[]> =>
    findFilesNamed({
      repositoryRoot,
      fileName: "AGENTS.md",
      ignoredDirectories: ["node_modules"],
    });

  test("every file of that name below the root is found, sorted by path", async () => {
    const repositoryRoot = repositoryWith({
      "packages/user/AGENTS.md": "# user\n",
      "AGENTS.md": "# root\n",
      "apps/site/AGENTS.md": "# site\n",
    });

    expect(await named(repositoryRoot)).toStrictEqual([
      "AGENTS.md",
      "apps/site/AGENTS.md",
      "packages/user/AGENTS.md",
    ]);
  });

  test("a file of another name is not found", async () => {
    const repositoryRoot = repositoryWith({ "packages/user/CLAUDE.md": "# user\n" });

    expect(await named(repositoryRoot)).toStrictEqual([]);
  });

  test("a directory the caller ignores is not walked into", async () => {
    const repositoryRoot = repositoryWith({
      "node_modules/vendor/AGENTS.md": "# vendored\n",
      "AGENTS.md": "# root\n",
    });

    expect(await named(repositoryRoot)).toStrictEqual(["AGENTS.md"]);
  });

  test("a symlink is not followed, whatever it points at", async () => {
    const repositoryRoot = repositoryWith({ "AGENTS.md": "# root\n" });
    symlinkSync(join(repositoryRoot, "AGENTS.md"), join(repositoryRoot, "linked"));
    symlinkSync(join(repositoryRoot, "AGENTS.md"), join(repositoryRoot, "AGENTS.md.link"));

    expect(await named(repositoryRoot)).toStrictEqual(["AGENTS.md"]);
  });

  test("something that is neither a file nor a directory is left out", async () => {
    const repositoryRoot = repositoryWith({ "AGENTS.md": "# root\n" });
    const socket = createServer();
    onTestFinished(() => {
      socket.close();
    });
    await new Promise<void>((listening) => {
      socket.listen(join(repositoryRoot, "AGENTS.md.socket"), listening);
    });

    expect(await named(repositoryRoot)).toStrictEqual(["AGENTS.md"]);
  });
});
