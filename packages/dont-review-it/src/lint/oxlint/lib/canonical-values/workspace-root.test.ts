import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { findWorkspaceRoot } from "./workspace-root.ts";

describe("workspace-root", () => {
  const thisDirectory = import.meta.dirname;

  const repositoryRoot = resolve(thisDirectory, "../../../../../../..");

  test("the directory holding the workspace manifest is the root", () => {
    expect(findWorkspaceRoot(repositoryRoot)).toBe(repositoryRoot);
  });

  test("a package directory reports the workspace above it rather than itself", () => {
    expect(findWorkspaceRoot(join(repositoryRoot, "packages/dont-review-it"))).toBe(repositoryRoot);
    expect(findWorkspaceRoot(join(repositoryRoot, "packages/dont-review-it/src/lint"))).toBe(
      repositoryRoot,
    );
  });

  test("a directory under no workspace keeps itself as the root", () => {
    const detached = mkdtempSync(join(tmpdir(), "mst-workspace-root-"));
    expect(findWorkspaceRoot(detached)).toBe(resolve(detached));
  });
});
