import { resolve, sep } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  aliasedSpecifierIn,
  entriesInForceAt,
  internalAliasesFrom,
  matchingRestrictedTarget,
  RESTRICTED_TARGET_SCHEMA,
  restrictedTargetsFrom,
  type RestrictedTargetEntry,
} from "./restricted-entries.ts";

const substitute = "Take the same values from the shared reader.";

const entryFor = (
  held: Partial<RestrictedTargetEntry> & { readonly module: string },
): RestrictedTargetEntry => ({
  exports: [],
  allowedPositions: [],
  substitute,
  ...held,
});

const matchedName = (
  listedEntries: readonly RestrictedTargetEntry[],
  forwarded: { readonly specifier: string; readonly exported: string | null },
): string | null => matchingRestrictedTarget({ entries: listedEntries, forwarded })?.module ?? null;

const retiredLib = [entryFor({ module: "retired-lib" })];

const readFileOnly = [entryFor({ module: "node:fs", exports: ["readFileSync"] })];

describe("restricted-targets/restricted-entries", () => {
  test("an entry naming the module matches a specifier spelled the same way", () => {
    expect(matchedName(retiredLib, { specifier: "retired-lib", exported: null })).toBe(
      "retired-lib",
    );
  });

  test("a path inside the distributed package reaches the same entry", () => {
    expect(
      matchedName(retiredLib, { specifier: "retired-lib/deep/inner.js", exported: null }),
    ).toBe("retired-lib");
  });

  test("a package whose name merely begins with the restricted name is a separate name", () => {
    expect(matchedName(retiredLib, { specifier: "retired-lib-extra", exported: null })).toBe(null);
  });

  test("an entry naming exports leaves an export outside that list alone", () => {
    expect(matchedName(readFileOnly, { specifier: "node:fs", exported: "writeFileSync" })).toBe(
      null,
    );
  });

  test("an entry naming exports matches the export it names", () => {
    expect(matchedName(readFileOnly, { specifier: "node:fs", exported: "readFileSync" })).toBe(
      "node:fs",
    );
  });

  test("a forward that names no export carries every named export with it", () => {
    expect(matchedName(readFileOnly, { specifier: "node:fs", exported: null })).toBe("node:fs");
  });

  test("an entry stays in force at a position it does not allow", () => {
    const listedEntries = [entryFor({ module: "retired-lib", allowedPositions: ["owner/**"] })];
    const file = resolve("/repo", "reader", "reader.ts").split("/").join(sep);
    expect(entriesInForceAt({ entries: listedEntries, file, cwd: "/repo" })).toStrictEqual(
      listedEntries,
    );
  });

  test("an entry falls out of force at a position it allows", () => {
    const listedEntries = [entryFor({ module: "retired-lib", allowedPositions: ["owner/**"] })];
    const file = resolve("/repo", "owner", "reader.ts").split("/").join(sep);
    expect(entriesInForceAt({ entries: listedEntries, file, cwd: "/repo" })).toStrictEqual([]);
  });

  test("an entry missing the name of what it restricts is no entry", () => {
    expect(restrictedTargetsFrom([{ restricted: [{ substitute }] }])).toStrictEqual([]);
  });

  test("an entry whose module name is empty is no entry", () => {
    expect(restrictedTargetsFrom([{ restricted: [{ module: "", substitute }] }])).toStrictEqual([]);
  });

  test("an entry missing the instruction that replaces it is no entry", () => {
    expect(restrictedTargetsFrom([{ restricted: [{ module: "retired-lib" }] }])).toStrictEqual([]);
  });

  test("a name standing in the list with no declaration around it is no entry", () => {
    expect(restrictedTargetsFrom([{ restricted: ["retired-lib"] }])).toStrictEqual([]);
  });

  test("an entry naming a module and its replacement is read whole", () => {
    expect(
      restrictedTargetsFrom([
        { restricted: [{ module: "retired-lib", exports: ["readFile"], substitute }] },
      ]),
    ).toStrictEqual([
      { module: "retired-lib", exports: ["readFile"], allowedPositions: [], substitute },
    ]);
  });

  test("options carrying no listedEntries at all yield no listedEntries", () => {
    expect(restrictedTargetsFrom([])).toStrictEqual([]);
  });

  test("a declaration written without the list around it carries no listedEntries", () => {
    expect(
      restrictedTargetsFrom([{ restricted: { module: "retired-lib", substitute } }]),
    ).toStrictEqual([]);
  });

  test("options naming only the prefixes they declare restrict nothing", () => {
    expect(
      restrictedTargetsFrom([{ internalAliases: [{ prefix: "~/", directory: "shared" }] }]),
    ).toStrictEqual([]);
  });

  test("a prefix declared with the directory it stands for is read whole", () => {
    expect(
      internalAliasesFrom([{ internalAliases: [{ prefix: "~/", directory: "src" }] }]),
    ).toStrictEqual([{ prefix: "~/", directory: "src" }]);
  });

  test("a prefix declared without the directory it stands for is no alias", () => {
    expect(internalAliasesFrom([{ internalAliases: [{ prefix: "~/" }] }])).toStrictEqual([]);
  });

  test("a directory declared without the prefix standing for it is no alias", () => {
    expect(internalAliasesFrom([{ internalAliases: [{ directory: "shared" }] }])).toStrictEqual([]);
  });

  test("a prefix declared empty is no alias", () => {
    expect(
      internalAliasesFrom([{ internalAliases: [{ prefix: "", directory: "shared" }] }]),
    ).toStrictEqual([]);
  });

  test("a prefix standing in the list with no declaration around it is no alias", () => {
    expect(internalAliasesFrom([{ internalAliases: ["~/"] }])).toStrictEqual([]);
  });

  test("a declared prefix resolves to the directory it stands for", () => {
    expect(
      aliasedSpecifierIn({
        specifier: "~/forward.ts",
        aliases: [{ prefix: "~/", directory: "shared" }],
        workspaceRoot: resolve("/repo"),
      }),
    ).toBe(resolve("/repo", "shared", "forward.ts"));
  });

  test("a specifier matching no declared prefix stands for nothing", () => {
    expect(
      aliasedSpecifierIn({
        specifier: "@other/forward.ts",
        aliases: [{ prefix: "~/", directory: "shared" }],
        workspaceRoot: resolve("/repo"),
      }),
    ).toBe(null);
  });

  test("the options schema declares the entry shape and refuses any other key", () => {
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
