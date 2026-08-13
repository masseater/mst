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

const MIXED_ASSET_SCRIPTS_ROOT = join(tmpdir(), "source-files-mixed-assets-scripts");

const MIXED_ASSET_STYLES_ROOT = join(tmpdir(), "source-files-mixed-assets-styles");

const MIXED_ASSET_MARKUP_ROOT = join(tmpdir(), "source-files-mixed-assets-markup");

const MIXED_ASSET_MANIFESTS_ROOT = join(tmpdir(), "source-files-mixed-assets-manifests");

describe("listRepositoryFiles", () => {
  describe("a file that is neither a script nor a manifest", () => {
    const it = test.extend("commentSourcePathsBesideANonScript", ({}, { onCleanup }) => {
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
    });

    it("is left out of the listing", ({ commentSourcePathsBesideANonScript }) => {
      expect(commentSourcePathsBesideANonScript).toStrictEqual(["src/order.ts"]);
    });
  });

  describe("an entry the directory lists but the file system cannot reach", () => {
    const it = test.extend("commentSourcePathsBesideALinkToNothing", ({}, { onCleanup }) => {
      rmSync(UNREACHABLE_TARGET_ROOT, { recursive: true, force: true });
      mkdirSync(join(UNREACHABLE_TARGET_ROOT, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(UNREACHABLE_TARGET_ROOT, { recursive: true, force: true });
      });
      writeFileSync(
        join(UNREACHABLE_TARGET_ROOT, "src", "present.ts"),
        "export const total = 1;\n",
      );
      symlinkSync(
        join(UNREACHABLE_TARGET_ROOT, "src", "removed.ts"),
        join(UNREACHABLE_TARGET_ROOT, "src", "gone.ts"),
      );
      return listRepositoryFiles(UNREACHABLE_TARGET_ROOT).commentSources.map(
        (file) => file.relativePath,
      );
    });

    it("is left out", ({ commentSourcePathsBesideALinkToNothing }) => {
      expect(commentSourcePathsBesideALinkToNothing).toStrictEqual(["src/present.ts"]);
    });
  });

  describe("an entry that resolves to a directory", () => {
    const it = test.extend("commentSourcePathsBesideALinkToADirectory", ({}, { onCleanup }) => {
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
    });

    it("is left out of the listing", ({ commentSourcePathsBesideALinkToADirectory }) => {
      expect(commentSourcePathsBesideALinkToADirectory).toStrictEqual(["src/present.ts"]);
    });
  });

  describe("a script standing beside a style sheet and a markup file", () => {
    const it = test.extend("commentSourcePathsBesideAssets", ({}, { onCleanup }) => {
      rmSync(MIXED_ASSET_SCRIPTS_ROOT, { recursive: true, force: true });
      mkdirSync(join(MIXED_ASSET_SCRIPTS_ROOT, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(MIXED_ASSET_SCRIPTS_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(MIXED_ASSET_SCRIPTS_ROOT, "package.json"), "{}");
      writeFileSync(join(MIXED_ASSET_SCRIPTS_ROOT, "src", "order.ts"), "export const total = 1;\n");
      writeFileSync(
        join(MIXED_ASSET_SCRIPTS_ROOT, "src", "order.css"),
        ".total {\n  color: red;\n}\n",
      );
      writeFileSync(join(MIXED_ASSET_SCRIPTS_ROOT, "src", "icon.svg"), "<svg></svg>\n");
      writeFileSync(join(MIXED_ASSET_SCRIPTS_ROOT, "index.html"), "<div></div>\n");
      return listRepositoryFiles(MIXED_ASSET_SCRIPTS_ROOT).commentSources.map(
        (file) => file.relativePath,
      );
    });

    it("is listed as a script", ({ commentSourcePathsBesideAssets }) => {
      expect(commentSourcePathsBesideAssets).toStrictEqual(["src/order.ts"]);
    });
  });

  describe("a style sheet standing beside a script", () => {
    const it = test.extend("styleSheetPathsBesideScripts", ({}, { onCleanup }) => {
      rmSync(MIXED_ASSET_STYLES_ROOT, { recursive: true, force: true });
      mkdirSync(join(MIXED_ASSET_STYLES_ROOT, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(MIXED_ASSET_STYLES_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(MIXED_ASSET_STYLES_ROOT, "package.json"), "{}");
      writeFileSync(join(MIXED_ASSET_STYLES_ROOT, "src", "order.ts"), "export const total = 1;\n");
      writeFileSync(
        join(MIXED_ASSET_STYLES_ROOT, "src", "order.css"),
        ".total {\n  color: red;\n}\n",
      );
      writeFileSync(join(MIXED_ASSET_STYLES_ROOT, "src", "icon.svg"), "<svg></svg>\n");
      writeFileSync(join(MIXED_ASSET_STYLES_ROOT, "index.html"), "<div></div>\n");
      return listRepositoryFiles(MIXED_ASSET_STYLES_ROOT).styleSheets.map(
        (file) => file.relativePath,
      );
    });

    it("is listed apart from the scripts", ({ styleSheetPathsBesideScripts }) => {
      expect(styleSheetPathsBesideScripts).toStrictEqual(["src/order.css"]);
    });
  });

  describe("a markup file standing beside a script", () => {
    const it = test.extend("markupSourcePathsBesideScripts", ({}, { onCleanup }) => {
      rmSync(MIXED_ASSET_MARKUP_ROOT, { recursive: true, force: true });
      mkdirSync(join(MIXED_ASSET_MARKUP_ROOT, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(MIXED_ASSET_MARKUP_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(MIXED_ASSET_MARKUP_ROOT, "package.json"), "{}");
      writeFileSync(join(MIXED_ASSET_MARKUP_ROOT, "src", "order.ts"), "export const total = 1;\n");
      writeFileSync(
        join(MIXED_ASSET_MARKUP_ROOT, "src", "order.css"),
        ".total {\n  color: red;\n}\n",
      );
      writeFileSync(join(MIXED_ASSET_MARKUP_ROOT, "src", "icon.svg"), "<svg></svg>\n");
      writeFileSync(join(MIXED_ASSET_MARKUP_ROOT, "index.html"), "<div></div>\n");
      return listRepositoryFiles(MIXED_ASSET_MARKUP_ROOT).markupSources.map(
        (file) => file.relativePath,
      );
    });

    it("is listed apart from the scripts", ({ markupSourcePathsBesideScripts }) => {
      expect(markupSourcePathsBesideScripts).toStrictEqual(["index.html", "src/icon.svg"]);
    });
  });

  describe("a manifest standing beside a script", () => {
    const it = test.extend("manifestPathsBesideScripts", ({}, { onCleanup }) => {
      rmSync(MIXED_ASSET_MANIFESTS_ROOT, { recursive: true, force: true });
      mkdirSync(join(MIXED_ASSET_MANIFESTS_ROOT, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(MIXED_ASSET_MANIFESTS_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(MIXED_ASSET_MANIFESTS_ROOT, "package.json"), "{}");
      writeFileSync(
        join(MIXED_ASSET_MANIFESTS_ROOT, "src", "order.ts"),
        "export const total = 1;\n",
      );
      writeFileSync(
        join(MIXED_ASSET_MANIFESTS_ROOT, "src", "order.css"),
        ".total {\n  color: red;\n}\n",
      );
      writeFileSync(join(MIXED_ASSET_MANIFESTS_ROOT, "src", "icon.svg"), "<svg></svg>\n");
      writeFileSync(join(MIXED_ASSET_MANIFESTS_ROOT, "index.html"), "<div></div>\n");
      return listRepositoryFiles(MIXED_ASSET_MANIFESTS_ROOT).manifests.map(
        (file) => file.relativePath,
      );
    });

    it("is listed apart from the scripts", ({ manifestPathsBesideScripts }) => {
      expect(manifestPathsBesideScripts).toStrictEqual(["package.json"]);
    });
  });
});

describe("nearestPackageDirectory", () => {
  describe("a climb that reaches the top of the filesystem", () => {
    const it = test.extend("packageDirectoryAboveTheFilesystemRoot", () =>
      nearestPackageDirectory(sep, join(sep, "a-root-that-is-never-reached")));

    it("stops there", ({ packageDirectoryAboveTheFilesystemRoot }) => {
      expect(packageDirectoryAboveTheFilesystemRoot).toBe(null);
    });
  });

  describe("a directory that holds a manifest", () => {
    const it = test.extend("packageDirectoryOfADirectoryHoldingAManifest", ({}, { onCleanup }) => {
      rmSync(OWN_MANIFEST_ROOT, { recursive: true, force: true });
      mkdirSync(join(OWN_MANIFEST_ROOT, "packages", "order"), { recursive: true });
      onCleanup(() => {
        rmSync(OWN_MANIFEST_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(OWN_MANIFEST_ROOT, "packages", "order", "package.json"), "{}");
      return nearestPackageDirectory(
        join(OWN_MANIFEST_ROOT, "packages", "order"),
        OWN_MANIFEST_ROOT,
      );
    });

    it("is its own package", ({ packageDirectoryOfADirectoryHoldingAManifest }) => {
      expect(packageDirectoryOfADirectoryHoldingAManifest).toBe(
        join(OWN_MANIFEST_ROOT, "packages", "order"),
      );
    });
  });

  describe("a directory below a manifest", () => {
    const it = test.extend("packageDirectoryOfADirectoryBelowAManifest", ({}, { onCleanup }) => {
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
    });

    it("belongs to the package that holds it", ({ packageDirectoryOfADirectoryBelowAManifest }) => {
      expect(packageDirectoryOfADirectoryBelowAManifest).toBe(
        join(MANIFEST_ABOVE_ROOT, "packages", "order"),
      );
    });
  });

  describe("a directory standing between two manifests", () => {
    const it = test.extend("packageDirectoryBetweenTwoManifests", ({}, { onCleanup }) => {
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
    });

    it("belongs to the nearer manifest rather than the one further up", ({
      packageDirectoryBetweenTwoManifests,
    }) => {
      expect(packageDirectoryBetweenTwoManifests).toBe(
        join(RIVAL_MANIFESTS_ROOT, "packages", "order"),
      );
    });
  });

  describe("a directory under a repository whose root holds the only manifest", () => {
    const it = test.extend("packageDirectoryUnderARootHoldingTheOnlyManifest", ({}, {
      onCleanup,
    }) => {
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
    });

    it("belongs to the root", ({ packageDirectoryUnderARootHoldingTheOnlyManifest }) => {
      expect(packageDirectoryUnderARootHoldingTheOnlyManifest).toBe(ROOT_ONLY_MANIFEST_ROOT);
    });
  });

  describe("a directory under a repository whose root holds no manifest", () => {
    const it = test.extend("packageDirectoryUnderARootHoldingNoManifest", ({}, { onCleanup }) => {
      rmSync(NO_MANIFEST_ROOT, { recursive: true, force: true });
      mkdirSync(join(NO_MANIFEST_ROOT, "scripts"), { recursive: true });
      onCleanup(() => {
        rmSync(NO_MANIFEST_ROOT, { recursive: true, force: true });
      });
      return nearestPackageDirectory(join(NO_MANIFEST_ROOT, "scripts"), NO_MANIFEST_ROOT);
    });

    it("is left in no package", ({ packageDirectoryUnderARootHoldingNoManifest }) => {
      expect(packageDirectoryUnderARootHoldingNoManifest).toBe(null);
    });
  });
});
