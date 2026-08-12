import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { findFilesNamed } from "./repository-files.ts";

const it = test
  .extend("pathsFoundAcrossTheWholeRepository", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "repository-files-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries({
      "packages/user/AGENTS.md": "# user\n",
      "AGENTS.md": "# root\n",
      "apps/site/AGENTS.md": "# site\n",
    })) {
      const target = join(repositoryRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return findFilesNamed({
      repositoryRoot,
      fileName: "AGENTS.md",
      ignoredDirectories: ["node_modules"],
    });
  })
  .extend("pathsFoundBesideAFileOfAnotherName", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "repository-files-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    const target = join(repositoryRoot, "packages/user/CLAUDE.md");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "# user\n", "utf8");
    return findFilesNamed({
      repositoryRoot,
      fileName: "AGENTS.md",
      ignoredDirectories: ["node_modules"],
    });
  })
  .extend("pathsFoundBesideAnIgnoredDirectory", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "repository-files-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries({
      "node_modules/vendor/AGENTS.md": "# vendored\n",
      "AGENTS.md": "# root\n",
    })) {
      const target = join(repositoryRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return findFilesNamed({
      repositoryRoot,
      fileName: "AGENTS.md",
      ignoredDirectories: ["node_modules"],
    });
  })
  .extend("pathsFoundBesideSymbolicLinks", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "repository-files-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    writeFileSync(join(repositoryRoot, "AGENTS.md"), "# root\n", "utf8");
    symlinkSync(join(repositoryRoot, "AGENTS.md"), join(repositoryRoot, "linked"));
    symlinkSync(join(repositoryRoot, "AGENTS.md"), join(repositoryRoot, "AGENTS.md.link"));
    return findFilesNamed({
      repositoryRoot,
      fileName: "AGENTS.md",
      ignoredDirectories: ["node_modules"],
    });
  })
  .extend("pathsFoundBesideASocket", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "repository-files-"));
    writeFileSync(join(repositoryRoot, "AGENTS.md"), "# root\n", "utf8");
    const socket = createServer();
    onCleanup(() => {
      socket.close();
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    await new Promise<void>((listening) => {
      socket.listen(join(repositoryRoot, "AGENTS.md.socket"), listening);
    });
    return findFilesNamed({
      repositoryRoot,
      fileName: "AGENTS.md",
      ignoredDirectories: ["node_modules"],
    });
  });

describe("findFilesNamed", () => {
  it("every file of that name below the root is found, sorted by path", ({
    pathsFoundAcrossTheWholeRepository,
  }) => {
    expect(pathsFoundAcrossTheWholeRepository).toStrictEqual([
      "AGENTS.md",
      "apps/site/AGENTS.md",
      "packages/user/AGENTS.md",
    ]);
  });

  it("a file of another name is not found", ({ pathsFoundBesideAFileOfAnotherName }) => {
    expect(pathsFoundBesideAFileOfAnotherName).toStrictEqual([]);
  });

  it("a directory the caller ignores is not walked into", ({
    pathsFoundBesideAnIgnoredDirectory,
  }) => {
    expect(pathsFoundBesideAnIgnoredDirectory).toStrictEqual(["AGENTS.md"]);
  });

  it("a symlink is not followed, whatever it points at", ({ pathsFoundBesideSymbolicLinks }) => {
    expect(pathsFoundBesideSymbolicLinks).toStrictEqual(["AGENTS.md"]);
  });

  it("something that is neither a file nor a directory is left out", ({
    pathsFoundBesideASocket,
  }) => {
    expect(pathsFoundBesideASocket).toStrictEqual(["AGENTS.md"]);
  });
});
