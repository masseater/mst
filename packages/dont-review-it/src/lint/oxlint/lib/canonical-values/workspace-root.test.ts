import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vite-plus/test";

import { findWorkspaceRoot } from "./workspace-root.ts";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../..");

const DETACHED_DIRECTORY = join(tmpdir(), "mst-workspace-root-detached");

const it = test
  .extend("rootOfManifestDirectory", () => findWorkspaceRoot(REPOSITORY_ROOT))
  .extend("rootOfPackageDirectory", () =>
    findWorkspaceRoot(join(REPOSITORY_ROOT, "packages/dont-review-it")),
  )
  .extend("rootOfNestedSourceDirectory", () =>
    findWorkspaceRoot(join(REPOSITORY_ROOT, "packages/dont-review-it/src/lint")),
  )
  .extend("rootOfDetachedDirectory", ({}, { onCleanup }) => {
    mkdirSync(DETACHED_DIRECTORY, { recursive: true });
    onCleanup(() => {
      rmSync(DETACHED_DIRECTORY, { recursive: true, force: true });
    });
    return findWorkspaceRoot(DETACHED_DIRECTORY);
  });

describe("workspace-root", () => {
  it("the directory holding the workspace manifest is the root", ({ rootOfManifestDirectory }) => {
    expect(rootOfManifestDirectory).toBe(REPOSITORY_ROOT);
  });

  it("a package directory reports the workspace above it rather than itself", ({
    rootOfPackageDirectory,
  }) => {
    expect(rootOfPackageDirectory).toBe(REPOSITORY_ROOT);
  });

  it("a directory deeper inside a package reports the same workspace above it", ({
    rootOfNestedSourceDirectory,
  }) => {
    expect(rootOfNestedSourceDirectory).toBe(REPOSITORY_ROOT);
  });

  it("a directory under no workspace keeps itself as the root", ({ rootOfDetachedDirectory }) => {
    expect(rootOfDetachedDirectory).toBe(resolve(DETACHED_DIRECTORY));
  });
});
