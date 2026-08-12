import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { extendsOneOf, nearestTsconfigExtends } from "./nearest-tsconfig.ts";

const LIBRARY_PRESET = "dont-review-it/tsconfig/library.json";

const APP_PRESET = "dont-review-it/tsconfig/app.json";

const it = test
  .extend("workspaceRoot", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "nearest-tsconfig-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return root;
  })
  .extend("extendsOfSingleEntry", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "single");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "tsconfig.json"), '{ "extends": "./preset.json" }\n');
    return nearestTsconfigExtends(join(directory, "index.ts"));
  })
  .extend("specifiersOfSeveralEntries", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "several");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "extends": ["./first.json", "./second.json"] }\n',
    );
    const read = nearestTsconfigExtends(join(directory, "index.ts"));
    return read === null ? null : read.specifiers;
  })
  .extend("specifiersOfMixedEntries", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "mixed");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "tsconfig.json"), '{ "extends": ["./first.json", 7, null] }\n');
    const read = nearestTsconfigExtends(join(directory, "index.ts"));
    return read === null ? null : read.specifiers;
  })
  .extend("specifiersOfCommentedConfig", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "jsonc");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{\n  // the preset\n  "extends": "./preset.json",\n}\n',
    );
    const read = nearestTsconfigExtends(join(directory, "index.ts"));
    return read === null ? null : read.specifiers;
  })
  .extend("specifiersOfConfigWithoutExtends", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "bare");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "tsconfig.json"), '{ "compilerOptions": { "strict": true } }\n');
    const read = nearestTsconfigExtends(join(directory, "index.ts"));
    return read === null ? null : read.specifiers;
  })
  .extend("specifiersOfUnreadableConfig", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "broken");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "tsconfig.json"), "{ not json\n");
    const read = nearestTsconfigExtends(join(directory, "index.ts"));
    return read === null ? null : read.specifiers;
  })
  .extend("extendsFoundByWalkingUp", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "nested");
    mkdirSync(join(directory, "src", "deep"), { recursive: true });
    writeFileSync(join(directory, "tsconfig.json"), '{ "extends": "./preset.json" }\n');
    return nearestTsconfigExtends(join(directory, "src", "deep", "index.ts"));
  })
  .extend("specifiersOfNearestConfig", ({ workspaceRoot }) => {
    const outer = join(workspaceRoot, "outer");
    mkdirSync(join(outer, "inner"), { recursive: true });
    writeFileSync(join(outer, "tsconfig.json"), '{ "extends": "./outer.json" }\n');
    writeFileSync(join(outer, "inner", "tsconfig.json"), '{ "extends": "./inner.json" }\n');
    const read = nearestTsconfigExtends(join(outer, "inner", "index.ts"));
    return read === null ? null : read.specifiers;
  })
  .extend("specifiersRememberedAfterRemoval", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "remembered");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "tsconfig.json"), '{ "extends": "./preset.json" }\n');
    nearestTsconfigExtends(join(directory, "index.ts"));
    rmSync(join(directory, "tsconfig.json"));
    const read = nearestTsconfigExtends(join(directory, "index.ts"));
    return read === null ? null : read.specifiers;
  })
  .extend("verdictOnPackageSpecifier", () =>
    extendsOneOf(["@mst/dont-review-it/tsconfig/library.json"], [LIBRARY_PRESET]),
  )
  .extend("verdictOnRelativeSpecifier", () =>
    extendsOneOf(["../dont-review-it/tsconfig/library.json"], [LIBRARY_PRESET]),
  )
  .extend("verdictOnListWithOneAllowedEntry", () =>
    extendsOneOf(
      ["./local.json", "@mst/dont-review-it/tsconfig/app.json"],
      [LIBRARY_PRESET, APP_PRESET],
    ),
  )
  .extend("verdictOnPresetOwnedBySomebodyElse", () =>
    extendsOneOf(["@other/tsconfig/library.json"], [LIBRARY_PRESET]),
  )
  .extend("verdictOnEmptySpecifierList", () => extendsOneOf([], [LIBRARY_PRESET]));

describe("nearestTsconfigExtends", () => {
  it("reads a single extends entry as a list of one", ({ extendsOfSingleEntry, workspaceRoot }) => {
    expect(extendsOfSingleEntry).toStrictEqual({
      tsconfigPath: join(workspaceRoot, "single", "tsconfig.json"),
      specifiers: ["./preset.json"],
    });
  });

  it("keeps every entry of an extends array in the order they were written", ({
    specifiersOfSeveralEntries,
  }) => {
    expect(specifiersOfSeveralEntries).toStrictEqual(["./first.json", "./second.json"]);
  });

  it("drops entries of an extends array that are not strings", ({ specifiersOfMixedEntries }) => {
    expect(specifiersOfMixedEntries).toStrictEqual(["./first.json"]);
  });

  it("reads a tsconfig that carries comments and a trailing comma", ({
    specifiersOfCommentedConfig,
  }) => {
    expect(specifiersOfCommentedConfig).toStrictEqual(["./preset.json"]);
  });

  it("reports no specifier for a tsconfig without an extends field", ({
    specifiersOfConfigWithoutExtends,
  }) => {
    expect(specifiersOfConfigWithoutExtends).toStrictEqual([]);
  });

  it("reports no specifier for a tsconfig that cannot be read as JSON", ({
    specifiersOfUnreadableConfig,
  }) => {
    expect(specifiersOfUnreadableConfig).toStrictEqual([]);
  });

  it("walks up until it meets a tsconfig", ({ extendsFoundByWalkingUp, workspaceRoot }) => {
    expect(extendsFoundByWalkingUp).toStrictEqual({
      tsconfigPath: join(workspaceRoot, "nested", "tsconfig.json"),
      specifiers: ["./preset.json"],
    });
  });

  it("stops at the nearest tsconfig instead of the outermost one", ({
    specifiersOfNearestConfig,
  }) => {
    expect(specifiersOfNearestConfig).toStrictEqual(["./inner.json"]);
  });

  it("remembers its answer, so a tsconfig removed afterwards still answers", ({
    specifiersRememberedAfterRemoval,
  }) => {
    expect(specifiersRememberedAfterRemoval).toStrictEqual(["./preset.json"]);
  });
});

describe("extendsOneOf", () => {
  it("matches a package specifier by the tail that names the preset file", ({
    verdictOnPackageSpecifier,
  }) => {
    expect(verdictOnPackageSpecifier).toBe(true);
  });

  it("matches a relative specifier that reaches the same file", ({
    verdictOnRelativeSpecifier,
  }) => {
    expect(verdictOnRelativeSpecifier).toBe(true);
  });

  it("accepts a list where only one entry names an allowed preset", ({
    verdictOnListWithOneAllowedEntry,
  }) => {
    expect(verdictOnListWithOneAllowedEntry).toBe(true);
  });

  it("rejects a preset of the same name owned by somebody else", ({
    verdictOnPresetOwnedBySomebodyElse,
  }) => {
    expect(verdictOnPresetOwnedBySomebodyElse).toBe(false);
  });

  it("rejects an empty list of specifiers", ({ verdictOnEmptySpecifierList }) => {
    expect(verdictOnEmptySpecifierList).toBe(false);
  });
});
