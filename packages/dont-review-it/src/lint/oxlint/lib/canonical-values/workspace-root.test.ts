import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { findWorkspaceRoot } from "./workspace-root.ts";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../../../../../..");

const DETACHED_DIRECTORY = join(tmpdir(), "mst-workspace-root-detached");

describe("findWorkspaceRoot", () => {
  describe("the directory holding the workspace manifest", () => {
    const it = test.extend("root", () => findWorkspaceRoot(REPOSITORY_ROOT));

    it("is the root", ({ root }) => {
      expect(root).toBe(REPOSITORY_ROOT);
    });
  });

  describe("a package directory", () => {
    const it = test.extend("root", () =>
      findWorkspaceRoot(join(REPOSITORY_ROOT, "packages/dont-review-it")));

    it("reports the workspace above it rather than itself", ({ root }) => {
      expect(root).toBe(REPOSITORY_ROOT);
    });
  });

  describe("a directory deeper inside a package", () => {
    const it = test.extend("root", () =>
      findWorkspaceRoot(join(REPOSITORY_ROOT, "packages/dont-review-it/src/lint")));

    it("reports the same workspace above it", ({ root }) => {
      expect(root).toBe(REPOSITORY_ROOT);
    });
  });

  describe("a directory under no workspace", () => {
    const it = test.extend("root", ({}, { onCleanup }) => {
      mkdirSync(DETACHED_DIRECTORY, { recursive: true });
      onCleanup(() => {
        rmSync(DETACHED_DIRECTORY, { recursive: true, force: true });
      });
      return findWorkspaceRoot(DETACHED_DIRECTORY);
    });

    it("keeps itself as the root", ({ root }) => {
      expect(root).toBe(resolve(DETACHED_DIRECTORY));
    });
  });
});
