import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  declaresPublicSubpath,
  isInsideDirectory,
  owningPackageDirectoryOf,
  publicEntryFilesOf,
} from "./package-entries.ts";

describe("publicEntryFilesOf", () => {
  describe("a manifest that is not an object", () => {
    const it = test.extend("entryFilesOfAManifestThatIsNotAnObject", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "package.json"), "[]");
      return publicEntryFilesOf(root);
    });

    it("declares no public entry", ({ entryFilesOfAManifestThatIsNotAnObject }) => {
      expect(entryFilesOfAManifestThatIsNotAnObject).toBe(null);
    });
  });

  describe("a directory holding no manifest", () => {
    const it = test.extend("entryFilesOfADirectoryHoldingNoManifest", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return publicEntryFilesOf(root);
    });

    it("declares no public entry", ({ entryFilesOfADirectoryHoldingNoManifest }) => {
      expect(entryFilesOfADirectoryHoldingNoManifest).toBe(null);
    });
  });

  describe("an entry named under a condition", () => {
    const it = test.extend("entryFilesOfAnEntryNamedUnderACondition", ({}, { onCleanup }) => {
      const root = join(tmpdir(), "setup-modules-package-entries-conditioned");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src/index.ts"), "export const entered = 1;\n");
      writeFileSync(join(root, "src/plugin.ts"), "export const plugged = 2;\n");
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({
          name: "@fixture/conditioned",
          exports: { ".": { import: "./src/index.ts" } },
        }),
      );
      return publicEntryFilesOf(root);
    });

    it("is taken as the entry of its subpath", ({ entryFilesOfAnEntryNamedUnderACondition }) => {
      expect(entryFilesOfAnEntryNamedUnderACondition).toStrictEqual([
        join(tmpdir(), "setup-modules-package-entries-conditioned", "src/index.ts"),
      ]);
    });
  });

  describe("a subpath offering several entries", () => {
    const it = test.extend("entryFilesOfASubpathOfferingSeveralEntries", ({}, { onCleanup }) => {
      const root = join(tmpdir(), "setup-modules-package-entries-several");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src/index.ts"), "export const entered = 1;\n");
      writeFileSync(join(root, "src/plugin.ts"), "export const plugged = 2;\n");
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({
          name: "@fixture/several",
          exports: { ".": ["./src/index.ts", "./src/plugin.ts"] },
        }),
      );
      return publicEntryFilesOf(root);
    });

    it("takes each of them", ({ entryFilesOfASubpathOfferingSeveralEntries }) => {
      expect(entryFilesOfASubpathOfferingSeveralEntries).toStrictEqual([
        join(tmpdir(), "setup-modules-package-entries-several", "src/index.ts"),
        join(tmpdir(), "setup-modules-package-entries-several", "src/plugin.ts"),
      ]);
    });
  });

  describe("an entry written as a bare specifier", () => {
    const it = test.extend("entryFilesOfAnEntryWrittenAsABareSpecifier", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src/index.ts"), "export const entered = 1;\n");
      writeFileSync(join(root, "src/plugin.ts"), "export const plugged = 2;\n");
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({
          name: "@fixture/redirected",
          exports: { ".": "other-package/entry.js" },
        }),
      );
      return publicEntryFilesOf(root);
    });

    it("is not a file of this package", ({ entryFilesOfAnEntryWrittenAsABareSpecifier }) => {
      expect(entryFilesOfAnEntryWrittenAsABareSpecifier).toBe(null);
    });
  });

  describe("an entry naming a file that was never built", () => {
    const it = test.extend("entryFilesOfAnEntryNamingAFileThatWasNeverBuilt", ({}, {
      onCleanup,
    }) => {
      const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src/index.ts"), "export const entered = 1;\n");
      writeFileSync(join(root, "src/plugin.ts"), "export const plugged = 2;\n");
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ name: "@fixture/unbuilt", exports: { ".": "./dist/index.js" } }),
      );
      return publicEntryFilesOf(root);
    });

    it("declares nothing this reading can follow", ({
      entryFilesOfAnEntryNamingAFileThatWasNeverBuilt,
    }) => {
      expect(entryFilesOfAnEntryNamingAFileThatWasNeverBuilt).toBe(null);
    });
  });
});

describe("declaresPublicSubpath", () => {
  describe("a manifest that is not an object", () => {
    const it = test.extend("subpathDeclaredByAManifestThatIsNotAnObject", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "package.json"), "[]");
      return declaresPublicSubpath({ packageDirectory: root, subpath: "." });
    });

    it("declares no subpath", ({ subpathDeclaredByAManifestThatIsNotAnObject }) => {
      expect(subpathDeclaredByAManifestThatIsNotAnObject).toBe(false);
    });
  });

  describe("a subpath written with a wildcard", () => {
    const it = test.extend("subpathSpannedByAWildcard", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src/index.ts"), "export const entered = 1;\n");
      writeFileSync(join(root, "src/plugin.ts"), "export const plugged = 2;\n");
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({
          name: "@fixture/spanned",
          exports: { ".": "./src/index.ts", "./tsconfig/*": "./tsconfig/*" },
        }),
      );
      return declaresPublicSubpath({
        packageDirectory: root,
        subpath: "./tsconfig/library.json",
      });
    });

    it("covers the paths it spans", ({ subpathSpannedByAWildcard }) => {
      expect(subpathSpannedByAWildcard).toBe(true);
    });
  });

  describe("a subpath of a different depth than the wildcard", () => {
    const it = test.extend("subpathOfADifferentDepthThanTheWildcard", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src/index.ts"), "export const entered = 1;\n");
      writeFileSync(join(root, "src/plugin.ts"), "export const plugged = 2;\n");
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({
          name: "@fixture/spanned",
          exports: { ".": "./src/index.ts", "./tsconfig/*": "./tsconfig/*" },
        }),
      );
      return declaresPublicSubpath({
        packageDirectory: root,
        subpath: "./tsconfig/base/app.json",
      });
    });

    it("is not covered by a wildcard", ({ subpathOfADifferentDepthThanTheWildcard }) => {
      expect(subpathOfADifferentDepthThanTheWildcard).toBe(false);
    });
  });
});

describe("owningPackageDirectoryOf", () => {
  describe("a file under no manifest at all", () => {
    const it = test.extend("owningPackageDirectoryOfAFileUnderNoManifest", () =>
      owningPackageDirectoryOf(join(parse(process.cwd()).root, "never-written-here.ts")));

    it("belongs to no package", ({ owningPackageDirectoryOfAFileUnderNoManifest }) => {
      expect(owningPackageDirectoryOfAFileUnderNoManifest).toBe(null);
    });
  });
});

describe("isInsideDirectory", () => {
  describe("a directory held against itself", () => {
    const it = test.extend("verdictOnADirectoryHeldAgainstItself", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return isInsideDirectory({ path: root, directory: root });
    });

    it("is not inside itself", ({ verdictOnADirectoryHeldAgainstItself }) => {
      expect(verdictOnADirectoryHeldAgainstItself).toBe(false);
    });
  });
});
