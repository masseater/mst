import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { findFilesNamed } from "./repository-files.ts";

describe("findFilesNamed", () => {
  describe("a repository carrying that name at several depths", () => {
    const it = test.extend("paths", async ({}, { onCleanup }) => {
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
    });

    it("finds every file of that name below the root, sorted by path", ({ paths }) => {
      expect(paths).toStrictEqual(["AGENTS.md", "apps/site/AGENTS.md", "packages/user/AGENTS.md"]);
    });
  });

  describe("a repository carrying a file of another name", () => {
    const it = test.extend("paths", async ({}, { onCleanup }) => {
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
    });

    it("finds nothing", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a repository carrying that name inside a directory the caller ignores", () => {
    const it = test.extend("paths", async ({}, { onCleanup }) => {
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
    });

    it("does not walk into that directory", ({ paths }) => {
      expect(paths).toStrictEqual(["AGENTS.md"]);
    });
  });

  describe("a repository carrying symbolic links beside that name", () => {
    const it = test.extend("paths", async ({}, { onCleanup }) => {
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
    });

    it("follows no link, whatever it points at", ({ paths }) => {
      expect(paths).toStrictEqual(["AGENTS.md"]);
    });
  });

  describe("a repository carrying a socket beside that name", () => {
    const it = test.extend("paths", async ({}, { onCleanup }) => {
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

    it("leaves out what is neither a file nor a directory", ({ paths }) => {
      expect(paths).toStrictEqual(["AGENTS.md"]);
    });
  });
});
