import { resolve, sep } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  aliasedSpecifierIn,
  entriesInForceAt,
  internalAliasesFrom,
  matchingRestrictedTarget,
  RESTRICTED_TARGET_SCHEMA,
  restrictedTargetsFrom,
} from "./restricted-entries.ts";

const substitute = "Take the same values from the shared reader.";

const it = test
  .extend("entryMatchedByASpecifierSpelledTheSameWay", () =>
    matchingRestrictedTarget({
      entries: [{ module: "retired-lib", exports: [], allowedPositions: [], substitute }],
      forwarded: { specifier: "retired-lib", exported: null },
    }))
  .extend("entryMatchedByAPathInsideTheDistributedPackage", () =>
    matchingRestrictedTarget({
      entries: [{ module: "retired-lib", exports: [], allowedPositions: [], substitute }],
      forwarded: { specifier: "retired-lib/deep/inner.js", exported: null },
    }),
  )
  .extend("entryMatchedByANameThatMerelyBeginsTheSameWay", () =>
    matchingRestrictedTarget({
      entries: [{ module: "retired-lib", exports: [], allowedPositions: [], substitute }],
      forwarded: { specifier: "retired-lib-extra", exported: null },
    }),
  )
  .extend("entryMatchedByAnExportOutsideTheNamedList", () =>
    matchingRestrictedTarget({
      entries: [{ module: "node:fs", exports: ["readFileSync"], allowedPositions: [], substitute }],
      forwarded: { specifier: "node:fs", exported: "writeFileSync" },
    }),
  )
  .extend("entryMatchedByTheExportItNames", () =>
    matchingRestrictedTarget({
      entries: [{ module: "node:fs", exports: ["readFileSync"], allowedPositions: [], substitute }],
      forwarded: { specifier: "node:fs", exported: "readFileSync" },
    }),
  )
  .extend("entryMatchedByAForwardThatNamesNoExport", () =>
    matchingRestrictedTarget({
      entries: [{ module: "node:fs", exports: ["readFileSync"], allowedPositions: [], substitute }],
      forwarded: { specifier: "node:fs", exported: null },
    }),
  )
  .extend("entriesInForceAtAPositionTheEntryDoesNotAllow", () =>
    entriesInForceAt({
      entries: [{ module: "retired-lib", exports: [], allowedPositions: ["owner/**"], substitute }],
      file: resolve("/repo", "reader", "reader.ts").split("/").join(sep),
      cwd: "/repo",
    }),
  )
  .extend("entriesInForceAtAPositionTheEntryAllows", () =>
    entriesInForceAt({
      entries: [{ module: "retired-lib", exports: [], allowedPositions: ["owner/**"], substitute }],
      file: resolve("/repo", "owner", "reader.ts").split("/").join(sep),
      cwd: "/repo",
    }),
  )
  .extend("entriesReadFromARowMissingTheModuleItRestricts", () =>
    restrictedTargetsFrom([{ restricted: [{ substitute }] }]),
  )
  .extend("entriesReadFromARowMissingTheSubstituteItNames", () =>
    restrictedTargetsFrom([{ restricted: [{ module: "retired-lib" }] }]),
  )
  .extend("entriesReadFromARowNamingAModuleAndItsSubstitute", () =>
    restrictedTargetsFrom([
      { restricted: [{ module: "retired-lib", exports: ["readFile"], substitute }] },
    ]),
  )
  .extend("entriesReadFromOptionsCarryingNoneAtAll", () => restrictedTargetsFrom([]))
  .extend("entriesDeclaredAsBareText", () =>
    restrictedTargetsFrom([{ restricted: ["retired-lib"] }]),
  )
  .extend("aliasesReadFromAPrefixWithTheDirectoryItStandsFor", () =>
    internalAliasesFrom([{ internalAliases: [{ prefix: "~/", directory: "src" }] }]),
  )
  .extend("aliasesReadFromAPrefixWithoutTheDirectoryItStandsFor", () =>
    internalAliasesFrom([{ internalAliases: [{ prefix: "~/" }] }]),
  )
  .extend("aliasesDeclaredAsBareText", () => internalAliasesFrom([{ internalAliases: ["~/"] }]))
  .extend("aliasesDeclaredWithAnEmptyPrefix", () =>
    internalAliasesFrom([{ internalAliases: [{ prefix: "", directory: "src" }] }]),
  )
  .extend("pathStoodForByADeclaredPrefix", () =>
    aliasedSpecifierIn({
      specifier: "~/forward.ts",
      aliases: [{ prefix: "~/", directory: "shared" }],
      workspaceRoot: resolve("/repo"),
    }),
  )
  .extend("pathStoodForByASpecifierMatchingNoDeclaredPrefix", () =>
    aliasedSpecifierIn({
      specifier: "@other/forward.ts",
      aliases: [{ prefix: "~/", directory: "shared" }],
      workspaceRoot: resolve("/repo"),
    }),
  );

describe("restricted-targets/restricted-entries", () => {
  it("an entry naming the module matches a specifier spelled the same way", ({
    entryMatchedByASpecifierSpelledTheSameWay,
  }) => {
    expect(entryMatchedByASpecifierSpelledTheSameWay).toStrictEqual({
      module: "retired-lib",
      exports: [],
      allowedPositions: [],
      substitute,
    });
  });

  it("a path inside the distributed package reaches the same entry", ({
    entryMatchedByAPathInsideTheDistributedPackage,
  }) => {
    expect(entryMatchedByAPathInsideTheDistributedPackage).toStrictEqual({
      module: "retired-lib",
      exports: [],
      allowedPositions: [],
      substitute,
    });
  });

  it("a package whose name merely begins with the restricted name is a separate name", ({
    entryMatchedByANameThatMerelyBeginsTheSameWay,
  }) => {
    expect(entryMatchedByANameThatMerelyBeginsTheSameWay).toBe(null);
  });

  it("an entry naming exports leaves an export outside that list alone", ({
    entryMatchedByAnExportOutsideTheNamedList,
  }) => {
    expect(entryMatchedByAnExportOutsideTheNamedList).toBe(null);
  });

  it("an entry naming exports matches the export it names", ({
    entryMatchedByTheExportItNames,
  }) => {
    expect(entryMatchedByTheExportItNames).toStrictEqual({
      module: "node:fs",
      exports: ["readFileSync"],
      allowedPositions: [],
      substitute,
    });
  });

  it("a forward that names no export carries every named export with it", ({
    entryMatchedByAForwardThatNamesNoExport,
  }) => {
    expect(entryMatchedByAForwardThatNamesNoExport).toStrictEqual({
      module: "node:fs",
      exports: ["readFileSync"],
      allowedPositions: [],
      substitute,
    });
  });

  it("an entry stays in force at a position it does not allow", ({
    entriesInForceAtAPositionTheEntryDoesNotAllow,
  }) => {
    expect(entriesInForceAtAPositionTheEntryDoesNotAllow).toStrictEqual([
      { module: "retired-lib", exports: [], allowedPositions: ["owner/**"], substitute },
    ]);
  });

  it("an entry falls out of force at a position it allows", ({
    entriesInForceAtAPositionTheEntryAllows,
  }) => {
    expect(entriesInForceAtAPositionTheEntryAllows).toStrictEqual([]);
  });

  it("an entry missing the name of what it restricts is no entry", ({
    entriesReadFromARowMissingTheModuleItRestricts,
  }) => {
    expect(entriesReadFromARowMissingTheModuleItRestricts).toStrictEqual([]);
  });

  it("an entry missing the instruction that replaces it is no entry", ({
    entriesReadFromARowMissingTheSubstituteItNames,
  }) => {
    expect(entriesReadFromARowMissingTheSubstituteItNames).toStrictEqual([]);
  });

  it("an entry naming a module and its replacement is read whole", ({
    entriesReadFromARowNamingAModuleAndItsSubstitute,
  }) => {
    expect(entriesReadFromARowNamingAModuleAndItsSubstitute).toStrictEqual([
      { module: "retired-lib", exports: ["readFile"], allowedPositions: [], substitute },
    ]);
  });

  it("options carrying no entries at all yield no entries", ({
    entriesReadFromOptionsCarryingNoneAtAll,
  }) => {
    expect(entriesReadFromOptionsCarryingNoneAtAll).toStrictEqual([]);
  });

  it("an entry written as bare text instead of a declaration is no entry", ({
    entriesDeclaredAsBareText,
  }) => {
    expect(entriesDeclaredAsBareText).toStrictEqual([]);
  });

  it("a prefix declared with the directory it stands for is read whole", ({
    aliasesReadFromAPrefixWithTheDirectoryItStandsFor,
  }) => {
    expect(aliasesReadFromAPrefixWithTheDirectoryItStandsFor).toStrictEqual([
      { prefix: "~/", directory: "src" },
    ]);
  });

  it("a prefix declared without the directory it stands for is no alias", ({
    aliasesReadFromAPrefixWithoutTheDirectoryItStandsFor,
  }) => {
    expect(aliasesReadFromAPrefixWithoutTheDirectoryItStandsFor).toStrictEqual([]);
  });

  it("a prefix written as bare text instead of a declaration is no alias", ({
    aliasesDeclaredAsBareText,
  }) => {
    expect(aliasesDeclaredAsBareText).toStrictEqual([]);
  });

  it("a prefix spelled as an empty string stands for nothing and is no alias", ({
    aliasesDeclaredWithAnEmptyPrefix,
  }) => {
    expect(aliasesDeclaredWithAnEmptyPrefix).toStrictEqual([]);
  });

  it("a declared prefix resolves to the directory it stands for", ({
    pathStoodForByADeclaredPrefix,
  }) => {
    expect(pathStoodForByADeclaredPrefix).toBe(resolve("/repo", "shared", "forward.ts"));
  });

  it("a specifier matching no declared prefix stands for nothing", ({
    pathStoodForByASpecifierMatchingNoDeclaredPrefix,
  }) => {
    expect(pathStoodForByASpecifierMatchingNoDeclaredPrefix).toBe(null);
  });

  it("the options schema declares the entry shape and refuses any other key", () => {
    expect(RESTRICTED_TARGET_SCHEMA).toStrictEqual([
      {
        type: "object",
        properties: {
          restricted: {
            type: "array",
            items: {
              type: "object",
              properties: {
                module: { type: "string" },
                exports: { type: "array", items: { type: "string" } },
                allowedPositions: { type: "array", items: { type: "string" } },
                substitute: { type: "string" },
              },
              required: ["module", "substitute"],
              additionalProperties: false,
            },
          },
          internalAliases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                prefix: { type: "string" },
                directory: { type: "string" },
              },
              required: ["prefix", "directory"],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ]);
  });
});
