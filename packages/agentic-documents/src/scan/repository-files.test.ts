import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { findFilesNamed, findFilesSuffixed } from "./repository-files.ts";

describe("findFilesNamed", () => {
  describe("a repository carrying that name at several depths", () => {
    const it = test.extend("paths", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "repository-files-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [path, markdownBody] of Object.entries({
        "packages/user/AGENTS.md": "# user\n",
        "AGENTS.md": "# root\n",
        "apps/site/AGENTS.md": "# site\n",
      })) {
        const documentPath = join(repositoryRoot, path);
        mkdirSync(dirname(documentPath), { recursive: true });
        writeFileSync(documentPath, markdownBody, "utf8");
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
      const documentPath = join(repositoryRoot, "packages/user/CLAUDE.md");
      mkdirSync(dirname(documentPath), { recursive: true });
      writeFileSync(documentPath, "# user\n", "utf8");
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
      for (const [path, markdownBody] of Object.entries({
        "node_modules/vendor/AGENTS.md": "# vendored\n",
        "AGENTS.md": "# root\n",
      })) {
        const documentPath = join(repositoryRoot, path);
        mkdirSync(dirname(documentPath), { recursive: true });
        writeFileSync(documentPath, markdownBody, "utf8");
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

describe("findFilesSuffixed", () => {
  describe("拡張子が同じ文書を階層の別々の深さに持つリポジトリ", () => {
    const it = test.extend("paths", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "repository-files-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [path, markdownBody] of Object.entries({
        "docs/guidelines/tests.md": "# tests\n",
        "AGENTS.md": "# root\n",
        "node_modules/vendor/README.md": "# vendored\n",
        "docs/notes.txt": "plain\n",
      })) {
        const documentPath = join(repositoryRoot, path);
        mkdirSync(dirname(documentPath), { recursive: true });
        writeFileSync(documentPath, markdownBody, "utf8");
      }
      return findFilesSuffixed({
        repositoryRoot,
        suffix: ".md",
        ignoredDirectories: ["node_modules"],
      });
    });

    it("無視する場所を除いた全ての一致をパス順に返す", ({ paths }) => {
      expect(paths).toStrictEqual(["AGENTS.md", "docs/guidelines/tests.md"]);
    });
  });
});
