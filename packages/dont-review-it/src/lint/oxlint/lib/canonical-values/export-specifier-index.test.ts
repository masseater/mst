import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { buildExportSpecifierIndex } from "./export-specifier-index.ts";

const it = test
  .extend("specifiersOfAPackageNamingItsRootExport", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": { ".": "./src/index.ts" } }',
    );
    writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("specifiersOfASubpathExport", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": { "./plugin": "./src/plugin.ts" } }',
    );
    writeFileSync(join(root, "src", "plugin.ts"), "export const total = 1;\n");
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("filesReachedThroughAReExportChain", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src", "vocabulary"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": "./src/index.ts" }',
    );
    writeFileSync(
      join(root, "src", "index.ts"),
      'export * from "./status.ts";\nexport type { Draft } from "./draft.js";\n',
    );
    writeFileSync(
      join(root, "src", "status.ts"),
      'export { STATUSES } from "./vocabulary/index.ts";\n',
    );
    writeFileSync(join(root, "src", "draft.ts"), "export type Draft = { readonly id: string };\n");
    writeFileSync(
      join(root, "src", "vocabulary", "index.ts"),
      'export const STATUSES = ["draft"];\n',
    );
    return [...buildExportSpecifierIndex(root)].map(([file]) => file.slice(root.length + 1));
  })
  .extend("specifiersBehindAReExportOfAnAbsentFile", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": "./src/index.ts" }',
    );
    writeFileSync(
      join(root, "src", "index.ts"),
      'export * from "./missing.ts";\nexport * from "node:path";\n',
    );
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("specifiersOfAFileReExportedFromTwoPlaces", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": { ".": "./src/index.ts", "./plugin": "./src/plugin.ts" } }',
    );
    writeFileSync(join(root, "src", "index.ts"), 'export * from "./shared.ts";\n');
    writeFileSync(join(root, "src", "plugin.ts"), 'export * from "./shared.ts";\n');
    writeFileSync(join(root, "src", "shared.ts"), "export const total = 1;\n");
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("specifiersOfAnExportMapNamingConditions", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": { ".": { "types": "./src/index.d.ts", "import": "./src/index.ts", "require": "./src/index.ts" }, "./package.json": "./package.json" } }',
    );
    writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("filesReachedThroughAReExportCycle", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": "./src/index.ts" }',
    );
    writeFileSync(join(root, "src", "index.ts"), 'export * from "./status.ts";\n');
    writeFileSync(join(root, "src", "status.ts"), 'export * from "./index.ts";\n');
    return [...buildExportSpecifierIndex(root)].map(([file]) => file.slice(root.length + 1));
  })
  .extend("filesReachedThroughAReExportChainPastTheLimit", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "package.json"), '{ "name": "@mst/user", "exports": "./src/a.ts" }');
    writeFileSync(join(root, "src", "a.ts"), 'export * from "./b.ts";\n');
    writeFileSync(join(root, "src", "b.ts"), 'export * from "./c.ts";\n');
    writeFileSync(join(root, "src", "c.ts"), 'export * from "./d.ts";\n');
    writeFileSync(join(root, "src", "d.ts"), 'export * from "./e.ts";\n');
    writeFileSync(join(root, "src", "e.ts"), 'export * from "./f.ts";\n');
    writeFileSync(join(root, "src", "f.ts"), "export const total = 1;\n");
    return [...buildExportSpecifierIndex(root)].map(([file]) => file.slice(root.length + 1));
  })
  .extend("specifiersOfAnEntryFileThePackageDoesNotHold", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": "./src/missing.ts" }',
    );
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("filesReachedThroughTwoConditionsNamingDifferentFiles", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": { ".": { "import": "./src/modern.ts", "require": "./src/legacy.ts" } } }',
    );
    writeFileSync(join(root, "src", "modern.ts"), "export const total = 1;\n");
    writeFileSync(join(root, "src", "legacy.ts"), "export const total = 1;\n");
    return [...buildExportSpecifierIndex(root)].map(([file]) => file.slice(root.length + 1));
  })
  .extend("specifiersOfAnExportTargetWithoutARelativeMarker", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": { ".": "src/index.ts" } }',
    );
    writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("specifiersOfAnExportMapNestedPastTheLimit", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": { ".": { "a": { "b": { "c": { "d": { "e": { "f": { "g": { "h": { "i": "./src/index.ts" } } } } } } } } } } }',
    );
    writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("specifiersOfAnExportMapHoldingAList", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      '{ "name": "@mst/user", "exports": { ".": ["./src/index.ts"] } }',
    );
    writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("specifiersOfAPackageNamingNoExportSurface", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "package.json"), '{ "name": "@mst/user" }');
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("specifiersOfADirectoryHoldingNoManifest", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("specifiersOfAManifestNamingNoPackage", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "package.json"), '{ "exports": "./src/index.ts" }');
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("specifiersOfAManifestWhoseNameIsEmpty", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "package.json"), '{ "name": "", "exports": "./src/index.ts" }');
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  })
  .extend("specifiersOfAManifestThatIsNotAnObject", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "package.json"), '"@mst/user"');
    return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);
  });

describe("buildExportSpecifierIndex", () => {
  it("a package that names its root export reaches the file behind it", ({
    specifiersOfAPackageNamingItsRootExport,
  }) => {
    expect(specifiersOfAPackageNamingItsRootExport).toStrictEqual([["src/index.ts", "@mst/user"]]);
  });

  it("a subpath export carries the specifier that names it", ({ specifiersOfASubpathExport }) => {
    expect(specifiersOfASubpathExport).toStrictEqual([["src/plugin.ts", "@mst/user/plugin"]]);
  });

  it("a re-export chain carries the specifier to every file it reaches", ({
    filesReachedThroughAReExportChain,
  }) => {
    expect(filesReachedThroughAReExportChain).toStrictEqual([
      "src/index.ts",
      "src/status.ts",
      "src/vocabulary/index.ts",
      "src/draft.ts",
    ]);
  });

  it("a re-export that names a file which is not there reaches nothing further", ({
    specifiersBehindAReExportOfAnAbsentFile,
  }) => {
    expect(specifiersBehindAReExportOfAnAbsentFile).toStrictEqual([["src/index.ts", "@mst/user"]]);
  });

  it("a file re-exported from two places keeps the specifier that reached it first", ({
    specifiersOfAFileReExportedFromTwoPlaces,
  }) => {
    expect(specifiersOfAFileReExportedFromTwoPlaces).toStrictEqual([
      ["src/index.ts", "@mst/user"],
      ["src/shared.ts", "@mst/user"],
      ["src/plugin.ts", "@mst/user/plugin"],
    ]);
  });

  it("an export map that names conditions reaches the file each of them names", ({
    specifiersOfAnExportMapNamingConditions,
  }) => {
    expect(specifiersOfAnExportMapNamingConditions).toStrictEqual([["src/index.ts", "@mst/user"]]);
  });

  it("a re-export cycle is walked once", ({ filesReachedThroughAReExportCycle }) => {
    expect(filesReachedThroughAReExportCycle).toStrictEqual(["src/index.ts", "src/status.ts"]);
  });

  it("a re-export chain deeper than the limit stops there", ({
    filesReachedThroughAReExportChainPastTheLimit,
  }) => {
    expect(filesReachedThroughAReExportChainPastTheLimit).toStrictEqual([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
      "src/d.ts",
      "src/e.ts",
    ]);
  });

  it("an entry file the manifest names but the package does not hold reaches only itself", ({
    specifiersOfAnEntryFileThePackageDoesNotHold,
  }) => {
    expect(specifiersOfAnEntryFileThePackageDoesNotHold).toStrictEqual([
      ["src/missing.ts", "@mst/user"],
    ]);
  });

  it("two conditions that name different files both stand behind the subpath", ({
    filesReachedThroughTwoConditionsNamingDifferentFiles,
  }) => {
    expect(filesReachedThroughTwoConditionsNamingDifferentFiles).toStrictEqual([
      "src/modern.ts",
      "src/legacy.ts",
    ]);
  });

  it("an export target that does not start with a relative marker is left out", ({
    specifiersOfAnExportTargetWithoutARelativeMarker,
  }) => {
    expect(specifiersOfAnExportTargetWithoutARelativeMarker).toStrictEqual([]);
  });

  it("an export map nested deeper than the limit is not followed", ({
    specifiersOfAnExportMapNestedPastTheLimit,
  }) => {
    expect(specifiersOfAnExportMapNestedPastTheLimit).toStrictEqual([]);
  });

  it("an export map holding a list is not read as conditions", ({
    specifiersOfAnExportMapHoldingAList,
  }) => {
    expect(specifiersOfAnExportMapHoldingAList).toStrictEqual([]);
  });

  it("a package that names no export surface reaches nothing", ({
    specifiersOfAPackageNamingNoExportSurface,
  }) => {
    expect(specifiersOfAPackageNamingNoExportSurface).toStrictEqual([]);
  });

  it("a directory that holds no manifest reaches nothing", ({
    specifiersOfADirectoryHoldingNoManifest,
  }) => {
    expect(specifiersOfADirectoryHoldingNoManifest).toStrictEqual([]);
  });

  it("a manifest that names no package reaches nothing", ({
    specifiersOfAManifestNamingNoPackage,
  }) => {
    expect(specifiersOfAManifestNamingNoPackage).toStrictEqual([]);
  });

  it("a manifest whose name is empty reaches nothing", ({
    specifiersOfAManifestWhoseNameIsEmpty,
  }) => {
    expect(specifiersOfAManifestWhoseNameIsEmpty).toStrictEqual([]);
  });

  it("a manifest that is not an object reaches nothing", ({
    specifiersOfAManifestThatIsNotAnObject,
  }) => {
    expect(specifiersOfAManifestThatIsNotAnObject).toStrictEqual([]);
  });
});
