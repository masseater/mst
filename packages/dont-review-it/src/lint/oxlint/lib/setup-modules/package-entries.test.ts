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

const it = test
  .extend("entryFilesOfAManifestThatIsNotAnObject", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "package.json"), "[]");
    return publicEntryFilesOf(root);
  })
  .extend("entryFilesOfADirectoryHoldingNoManifest", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return publicEntryFilesOf(root);
  })
  .extend("entryFilesOfAnEntryNamedUnderACondition", ({}, { onCleanup }) => {
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
  })
  .extend("entryFilesOfASubpathOfferingSeveralEntries", ({}, { onCleanup }) => {
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
  })
  .extend("entryFilesOfAnEntryWrittenAsABareSpecifier", ({}, { onCleanup }) => {
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
  })
  .extend("entryFilesOfAnEntryNamingAFileThatWasNeverBuilt", ({}, { onCleanup }) => {
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
  })
  .extend("subpathDeclaredByAManifestThatIsNotAnObject", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "package.json"), "[]");
    return declaresPublicSubpath({ packageDirectory: root, subpath: "." });
  })
  .extend("subpathSpannedByAWildcard", ({}, { onCleanup }) => {
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
  })
  .extend("subpathOfADifferentDepthThanTheWildcard", ({}, { onCleanup }) => {
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
  })
  .extend("owningPackageDirectoryOfAFileUnderNoManifest", () =>
    owningPackageDirectoryOf(join(parse(process.cwd()).root, "never-written-here.ts")),
  )
  .extend("verdictOnADirectoryHeldAgainstItself", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return isInsideDirectory({ path: root, directory: root });
  });

describe("setup-modules/package-entries", () => {
  it("a manifest that is not an object declares no public entry", ({
    entryFilesOfAManifestThatIsNotAnObject,
  }) => {
    expect(entryFilesOfAManifestThatIsNotAnObject).toBe(null);
  });

  it("a directory holding no manifest declares no public entry", ({
    entryFilesOfADirectoryHoldingNoManifest,
  }) => {
    expect(entryFilesOfADirectoryHoldingNoManifest).toBe(null);
  });

  it("an entry named under a condition is taken as the entry of its subpath", ({
    entryFilesOfAnEntryNamedUnderACondition,
  }) => {
    expect(entryFilesOfAnEntryNamedUnderACondition).toStrictEqual([
      join(tmpdir(), "setup-modules-package-entries-conditioned", "src/index.ts"),
    ]);
  });

  it("a subpath offering several entries takes each of them", ({
    entryFilesOfASubpathOfferingSeveralEntries,
  }) => {
    expect(entryFilesOfASubpathOfferingSeveralEntries).toStrictEqual([
      join(tmpdir(), "setup-modules-package-entries-several", "src/index.ts"),
      join(tmpdir(), "setup-modules-package-entries-several", "src/plugin.ts"),
    ]);
  });

  it("an entry written as a bare specifier is not a file of this package", ({
    entryFilesOfAnEntryWrittenAsABareSpecifier,
  }) => {
    expect(entryFilesOfAnEntryWrittenAsABareSpecifier).toBe(null);
  });

  it("an entry naming a file that was never built declares nothing this reading can follow", ({
    entryFilesOfAnEntryNamingAFileThatWasNeverBuilt,
  }) => {
    expect(entryFilesOfAnEntryNamingAFileThatWasNeverBuilt).toBe(null);
  });

  it("a manifest that is not an object declares no subpath", ({
    subpathDeclaredByAManifestThatIsNotAnObject,
  }) => {
    expect(subpathDeclaredByAManifestThatIsNotAnObject).toBe(false);
  });

  it("a subpath written with a wildcard covers the paths it spans", ({
    subpathSpannedByAWildcard,
  }) => {
    expect(subpathSpannedByAWildcard).toBe(true);
  });

  it("a subpath of a different depth is not covered by a wildcard", ({
    subpathOfADifferentDepthThanTheWildcard,
  }) => {
    expect(subpathOfADifferentDepthThanTheWildcard).toBe(false);
  });

  it("a file under no manifest at all belongs to no package", ({
    owningPackageDirectoryOfAFileUnderNoManifest,
  }) => {
    expect(owningPackageDirectoryOfAFileUnderNoManifest).toBe(null);
  });

  it("a directory is not inside itself", ({ verdictOnADirectoryHeldAgainstItself }) => {
    expect(verdictOnADirectoryHeldAgainstItself).toBe(false);
  });
});
