import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { collectWorkspaces } from "./workspaces.ts";

const DEFINITION_FILE = "pnpm-workspace.yaml";

const DEFINITION_FIELD = "packages";

describe("collectWorkspaces", () => {
  describe("a pattern that ends in a star", () => {
    const it = test.extend("collection", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [path, text] of Object.entries({
        [DEFINITION_FILE]: "packages:\n  - packages/*\n",
        "packages/session/package.json": '{"name":"session","description":"接続"}',
        "packages/user/package.json": '{"name":"user","description":"利用者"}',
      })) {
        const target = join(repositoryRoot, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text, "utf8");
      }
      return collectWorkspaces({
        repositoryRoot,
        definitionFile: DEFINITION_FILE,
        definitionField: DEFINITION_FIELD,
      });
    });

    it("names every directory below it", ({ collection }) => {
      expect(collection).toStrictEqual({
        entries: [
          { directory: "packages/session", description: "接続" },
          { directory: "packages/user", description: "利用者" },
        ],
        incomplete: [],
      });
    });
  });

  describe("a pattern that names one directory", () => {
    const it = test.extend("collection", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [path, text] of Object.entries({
        [DEFINITION_FILE]: "packages:\n  - tools/build\n",
        "tools/build/package.json": '{"name":"build","description":"組み立て"}',
      })) {
        const target = join(repositoryRoot, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text, "utf8");
      }
      return collectWorkspaces({
        repositoryRoot,
        definitionFile: DEFINITION_FILE,
        definitionField: DEFINITION_FIELD,
      });
    });

    it("is taken as it is", ({ collection }) => {
      expect(collection).toStrictEqual({
        entries: [{ directory: "tools/build", description: "組み立て" }],
        incomplete: [],
      });
    });
  });

  describe("workspaces missing the manifest and the description they declare", () => {
    const it = test.extend("collection", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [path, text] of Object.entries({
        [DEFINITION_FILE]: "packages:\n  - packages/*\n",
        "packages/session/package.json": '{"name":"session"}',
        "packages/user/README.md": "# user\n",
      })) {
        const target = join(repositoryRoot, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text, "utf8");
      }
      return collectWorkspaces({
        repositoryRoot,
        definitionFile: DEFINITION_FILE,
        definitionField: DEFINITION_FIELD,
      });
    });

    it("names each of them incomplete, with what it is missing", ({ collection }) => {
      expect(collection).toStrictEqual({
        entries: [],
        incomplete: [
          { directory: "packages/session", reason: "マニフェストに説明が無い" },
          { directory: "packages/user", reason: "マニフェストが無いか読めない" },
        ],
      });
    });
  });

  describe("a repository that declares no workspace definition", () => {
    const it = test.extend("collection", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "README.md"), "# read me\n", "utf8");
      return collectWorkspaces({
        repositoryRoot,
        definitionFile: DEFINITION_FILE,
        definitionField: DEFINITION_FIELD,
      });
    });

    it("names nothing", ({ collection }) => {
      expect(collection).toStrictEqual({ entries: [], incomplete: [] });
    });
  });

  describe("a definition that is not a mapping", () => {
    const it = test.extend("collection", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, DEFINITION_FILE), "- packages/*\n", "utf8");
      return collectWorkspaces({
        repositoryRoot,
        definitionFile: DEFINITION_FILE,
        definitionField: DEFINITION_FIELD,
      });
    });

    it("names nothing", ({ collection }) => {
      expect(collection).toStrictEqual({ entries: [], incomplete: [] });
    });
  });

  describe("a definition that holds nothing at all", () => {
    const it = test.extend("collection", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, DEFINITION_FILE), "\n", "utf8");
      return collectWorkspaces({
        repositoryRoot,
        definitionFile: DEFINITION_FILE,
        definitionField: DEFINITION_FIELD,
      });
    });

    it("names nothing", ({ collection }) => {
      expect(collection).toStrictEqual({ entries: [], incomplete: [] });
    });
  });

  describe("a definition whose field is not a list", () => {
    const it = test.extend("collection", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, DEFINITION_FILE), "packages: all\n", "utf8");
      return collectWorkspaces({
        repositoryRoot,
        definitionFile: DEFINITION_FILE,
        definitionField: DEFINITION_FIELD,
      });
    });

    it("names nothing", ({ collection }) => {
      expect(collection).toStrictEqual({ entries: [], incomplete: [] });
    });
  });

  describe("a list holding a pattern that is not a word", () => {
    const it = test.extend("collection", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [path, text] of Object.entries({
        [DEFINITION_FILE]: "packages:\n  - 1\n  - tools/build\n",
        "tools/build/package.json": '{"name":"build","description":"組み立て"}',
      })) {
        const target = join(repositoryRoot, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text, "utf8");
      }
      return collectWorkspaces({
        repositoryRoot,
        definitionFile: DEFINITION_FILE,
        definitionField: DEFINITION_FIELD,
      });
    });

    it("leaves that pattern out and keeps the rest", ({ collection }) => {
      expect(collection).toStrictEqual({
        entries: [{ directory: "tools/build", description: "組み立て" }],
        incomplete: [],
      });
    });
  });
});
