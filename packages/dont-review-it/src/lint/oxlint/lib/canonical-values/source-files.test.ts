import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { listRepositoryFiles, nearestPackageDirectory } from "./source-files.ts";

const MIXED_FILE_KINDS_ROOT = join(tmpdir(), "source-files-mixed-file-kinds");

const UNREACHABLE_TARGET_ROOT = join(tmpdir(), "source-files-unreachable-target");

const DIRECTORY_TARGET_ROOT = join(tmpdir(), "source-files-directory-target");

const OWN_MANIFEST_ROOT = join(tmpdir(), "source-files-own-manifest");

const MANIFEST_ABOVE_ROOT = join(tmpdir(), "source-files-manifest-above");

const RIVAL_MANIFESTS_ROOT = join(tmpdir(), "source-files-rival-manifests");

const ROOT_ONLY_MANIFEST_ROOT = join(tmpdir(), "source-files-root-only-manifest");

const NO_MANIFEST_ROOT = join(tmpdir(), "source-files-no-manifest");

const it = test
  .extend("packageDirectoryAboveTheFilesystemRoot", () =>
    nearestPackageDirectory(sep, join(sep, "a-root-that-is-never-reached")))
  .extend("commentSourcePathsBesideANonScript", ({}, { onCleanup }) => {
    rmSync(MIXED_FILE_KINDS_ROOT, { recursive: true, force: true });
    mkdirSync(join(MIXED_FILE_KINDS_ROOT, "src"), { recursive: true });
    onCleanup(() => {
      rmSync(MIXED_FILE_KINDS_ROOT, { recursive: true, force: true });
    });
    writeFileSync(join(MIXED_FILE_KINDS_ROOT, "src", "order.ts"), "export const total = 1;\n");
    writeFileSync(join(MIXED_FILE_KINDS_ROOT, "src", "README.md"), "# order\n");
    return listRepositoryFiles(MIXED_FILE_KINDS_ROOT).commentSources.map(
      (file) => file.relativePath,
    );
  })
  .extend("commentSourcePathsBesideALinkToNothing", ({}, { onCleanup }) => {
    rmSync(UNREACHABLE_TARGET_ROOT, { recursive: true, force: true });
    mkdirSync(join(UNREACHABLE_TARGET_ROOT, "src"), { recursive: true });
    onCleanup(() => {
      rmSync(UNREACHABLE_TARGET_ROOT, { recursive: true, force: true });
    });
    writeFileSync(join(UNREACHABLE_TARGET_ROOT, "src", "present.ts"), "export const total = 1;\n");
    symlinkSync(
      join(UNREACHABLE_TARGET_ROOT, "src", "removed.ts"),
      join(UNREACHABLE_TARGET_ROOT, "src", "gone.ts"),
    );
    return listRepositoryFiles(UNREACHABLE_TARGET_ROOT).commentSources.map(
      (file) => file.relativePath,
    );
  })
  .extend("commentSourcePathsBesideALinkToADirectory", ({}, { onCleanup }) => {
    rmSync(DIRECTORY_TARGET_ROOT, { recursive: true, force: true });
    mkdirSync(join(DIRECTORY_TARGET_ROOT, "src", "nested"), { recursive: true });
    onCleanup(() => {
      rmSync(DIRECTORY_TARGET_ROOT, { recursive: true, force: true });
    });
    writeFileSync(join(DIRECTORY_TARGET_ROOT, "src", "present.ts"), "export const total = 1;\n");
    symlinkSync(
      join(DIRECTORY_TARGET_ROOT, "src", "nested"),
      join(DIRECTORY_TARGET_ROOT, "src", "linked.ts"),
    );
    return listRepositoryFiles(DIRECTORY_TARGET_ROOT).commentSources.map(
      (file) => file.relativePath,
    );
  })
  .extend("packageDirectoryOfADirectoryHoldingAManifest", ({}, { onCleanup }) => {
    rmSync(OWN_MANIFEST_ROOT, { recursive: true, force: true });
    mkdirSync(join(OWN_MANIFEST_ROOT, "packages", "order"), { recursive: true });
    onCleanup(() => {
      rmSync(OWN_MANIFEST_ROOT, { recursive: true, force: true });
    });
    writeFileSync(join(OWN_MANIFEST_ROOT, "packages", "order", "package.json"), "{}");
    return nearestPackageDirectory(join(OWN_MANIFEST_ROOT, "packages", "order"), OWN_MANIFEST_ROOT);
  })
  .extend("packageDirectoryOfADirectoryBelowAManifest", ({}, { onCleanup }) => {
    rmSync(MANIFEST_ABOVE_ROOT, { recursive: true, force: true });
    mkdirSync(join(MANIFEST_ABOVE_ROOT, "packages", "order", "src", "lint"), { recursive: true });
    onCleanup(() => {
      rmSync(MANIFEST_ABOVE_ROOT, { recursive: true, force: true });
    });
    writeFileSync(join(MANIFEST_ABOVE_ROOT, "packages", "order", "package.json"), "{}");
    return nearestPackageDirectory(
      join(MANIFEST_ABOVE_ROOT, "packages", "order", "src", "lint"),
      MANIFEST_ABOVE_ROOT,
    );
  })
  .extend("packageDirectoryBetweenTwoManifests", ({}, { onCleanup }) => {
    rmSync(RIVAL_MANIFESTS_ROOT, { recursive: true, force: true });
    mkdirSync(join(RIVAL_MANIFESTS_ROOT, "packages", "order", "src"), { recursive: true });
    onCleanup(() => {
      rmSync(RIVAL_MANIFESTS_ROOT, { recursive: true, force: true });
    });
    writeFileSync(join(RIVAL_MANIFESTS_ROOT, "package.json"), "{}");
    writeFileSync(join(RIVAL_MANIFESTS_ROOT, "packages", "order", "package.json"), "{}");
    return nearestPackageDirectory(
      join(RIVAL_MANIFESTS_ROOT, "packages", "order", "src"),
      RIVAL_MANIFESTS_ROOT,
    );
  })
  .extend("packageDirectoryUnderARootHoldingTheOnlyManifest", ({}, { onCleanup }) => {
    rmSync(ROOT_ONLY_MANIFEST_ROOT, { recursive: true, force: true });
    mkdirSync(join(ROOT_ONLY_MANIFEST_ROOT, "scripts"), { recursive: true });
    onCleanup(() => {
      rmSync(ROOT_ONLY_MANIFEST_ROOT, { recursive: true, force: true });
    });
    writeFileSync(join(ROOT_ONLY_MANIFEST_ROOT, "package.json"), "{}");
    return nearestPackageDirectory(
      join(ROOT_ONLY_MANIFEST_ROOT, "scripts"),
      ROOT_ONLY_MANIFEST_ROOT,
    );
  })
  .extend("packageDirectoryUnderARootHoldingNoManifest", ({}, { onCleanup }) => {
    rmSync(NO_MANIFEST_ROOT, { recursive: true, force: true });
    mkdirSync(join(NO_MANIFEST_ROOT, "scripts"), { recursive: true });
    onCleanup(() => {
      rmSync(NO_MANIFEST_ROOT, { recursive: true, force: true });
    });
    return nearestPackageDirectory(join(NO_MANIFEST_ROOT, "scripts"), NO_MANIFEST_ROOT);
  });

describe("source-files", () => {
  it("a climb that reaches the top of the filesystem stops there", ({
    packageDirectoryAboveTheFilesystemRoot,
  }) => {
    expect(packageDirectoryAboveTheFilesystemRoot).toBe(null);
  });

  it("a file that is neither a script nor a manifest is left out of the listing", ({
    commentSourcePathsBesideANonScript,
  }) => {
    expect(commentSourcePathsBesideANonScript).toStrictEqual(["src/order.ts"]);
  });

  it("an entry the directory lists but the file system cannot reach is left out", ({
    commentSourcePathsBesideALinkToNothing,
  }) => {
    expect(commentSourcePathsBesideALinkToNothing).toStrictEqual(["src/present.ts"]);
  });

  it("an entry that resolves to a directory is left out of the listing", ({
    commentSourcePathsBesideALinkToADirectory,
  }) => {
    expect(commentSourcePathsBesideALinkToADirectory).toStrictEqual(["src/present.ts"]);
  });

  it("a directory that holds a manifest is its own package", ({
    packageDirectoryOfADirectoryHoldingAManifest,
  }) => {
    expect(packageDirectoryOfADirectoryHoldingAManifest).toBe(
      join(OWN_MANIFEST_ROOT, "packages", "order"),
    );
  });

  it("a directory below a manifest belongs to the package that holds it", ({
    packageDirectoryOfADirectoryBelowAManifest,
  }) => {
    expect(packageDirectoryOfADirectoryBelowAManifest).toBe(
      join(MANIFEST_ABOVE_ROOT, "packages", "order"),
    );
  });

  it("the nearer manifest wins over the one further up", ({
    packageDirectoryBetweenTwoManifests,
  }) => {
    expect(packageDirectoryBetweenTwoManifests).toBe(
      join(RIVAL_MANIFESTS_ROOT, "packages", "order"),
    );
  });

  it("a directory under a repository whose root holds the only manifest belongs to the root", ({
    packageDirectoryUnderARootHoldingTheOnlyManifest,
  }) => {
    expect(packageDirectoryUnderARootHoldingTheOnlyManifest).toBe(ROOT_ONLY_MANIFEST_ROOT);
  });

  it("a repository whose root holds no manifest leaves the file in no package", ({
    packageDirectoryUnderARootHoldingNoManifest,
  }) => {
    expect(packageDirectoryUnderARootHoldingNoManifest).toBe(null);
  });
});
