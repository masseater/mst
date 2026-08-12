import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { loadRepositoryTypeAuthorityIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const SHAPE =
  "export type Shape = { readonly a: string; readonly b: number; readonly c: Named };\n";

const it = test
  .extend("indexedPathsOfARepositoryHoldingOneTypeSource", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.ts"), SHAPE, "utf8");
    return Array.from(
      loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
    );
  })
  .extend("indexedPathsBesideASourceDeclaringNoExportedType", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.ts"), SHAPE, "utf8");
    writeFileSync(join(root, "src", "b.ts"), "export {};\n", "utf8");
    return Array.from(
      loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
    );
  })
  .extend("indexedPathsOfARepositoryHoldingOnlyATestFile", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.test.ts"), SHAPE, "utf8");
    return Array.from(
      loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
    );
  })
  .extend("indexedPathsOfARepositoryHoldingNoSource", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "README.md"), "# held\n", "utf8");
    return Array.from(
      loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
    );
  })
  .extend("indexedPathsBesideASourceThatCannotBeRead", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a-unreadable.ts"), SHAPE, "utf8");
    writeFileSync(join(root, "src", "b-present.ts"), SHAPE, "utf8");
    vi.mocked(readTextFile).mockReturnValueOnce(null);
    return Array.from(
      loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
    );
  })
  .extend("workspacePathsOfTheTypesStandingBesideAManifest", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "packages", "order", "src"), { recursive: true });
    writeFileSync(join(root, "packages", "order", "package.json"), "{}", "utf8");
    writeFileSync(join(root, "packages", "order", "src", "a.ts"), SHAPE, "utf8");
    return loadRepositoryTypeAuthorityIndex({ repositoryRoot: root })
      .typesByPath.get("packages/order/src/a.ts")
      ?.map((indexed) => indexed.workspacePath);
  })
  .extend("workspacePathsOfTheTypesStandingUnderNoManifest", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.ts"), SHAPE, "utf8");
    return loadRepositoryTypeAuthorityIndex({ repositoryRoot: root })
      .typesByPath.get("src/a.ts")
      ?.map((indexed) => indexed.workspacePath);
  })
  .extend("sameIndexHandedBackOnTheLaterAsk", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.ts"), SHAPE, "utf8");
    return (
      loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }) ===
      loadRepositoryTypeAuthorityIndex({ repositoryRoot: root })
    );
  });

describe("loadRepositoryTypeAuthorityIndex", () => {
  it("a source declaring an exported type is placed in the index", ({
    indexedPathsOfARepositoryHoldingOneTypeSource,
  }) => {
    expect(indexedPathsOfARepositoryHoldingOneTypeSource).toStrictEqual(["src/a.ts"]);
  });

  it("a source declaring no exported type is left out of the index", ({
    indexedPathsBesideASourceDeclaringNoExportedType,
  }) => {
    expect(indexedPathsBesideASourceDeclaringNoExportedType).toStrictEqual(["src/a.ts"]);
  });

  it("a test file is left out of the index", ({
    indexedPathsOfARepositoryHoldingOnlyATestFile,
  }) => {
    expect(indexedPathsOfARepositoryHoldingOnlyATestFile).toStrictEqual([]);
  });

  it("a repository holding no source at all is indexed as empty", ({
    indexedPathsOfARepositoryHoldingNoSource,
  }) => {
    expect(indexedPathsOfARepositoryHoldingNoSource).toStrictEqual([]);
  });

  it("a source that cannot be read is left out of the index", ({
    indexedPathsBesideASourceThatCannotBeRead,
  }) => {
    expect(indexedPathsBesideASourceThatCannotBeRead).toStrictEqual(["src/b-present.ts"]);
  });

  it("a type is placed in the workspace whose manifest stands nearest to it", ({
    workspacePathsOfTheTypesStandingBesideAManifest,
  }) => {
    expect(workspacePathsOfTheTypesStandingBesideAManifest).toStrictEqual(["packages/order"]);
  });

  it("a type under no manifest at all belongs to the repository root", ({
    workspacePathsOfTheTypesStandingUnderNoManifest,
  }) => {
    expect(workspacePathsOfTheTypesStandingUnderNoManifest).toStrictEqual([""]);
  });

  it("the index of a repository is built once and handed back on every later ask", ({
    sameIndexHandedBackOnTheLaterAsk,
  }) => {
    expect(sameIndexHandedBackOnTheLaterAsk).toBe(true);
  });
});
