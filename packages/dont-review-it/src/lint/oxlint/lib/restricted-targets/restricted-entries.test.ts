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

describe("matchingRestrictedTarget", () => {
  describe("an entry naming the module", () => {
    const it = test.extend("entry", () =>
      matchingRestrictedTarget({
        entries: [{ module: "retired-lib", exports: [], allowedPositions: [], substitute }],
        forwarded: { specifier: "retired-lib", exported: null },
      }));

    it("matches a specifier spelled the same way", ({ entry }) => {
      expect(entry).toStrictEqual({
        module: "retired-lib",
        exports: [],
        allowedPositions: [],
        substitute,
      });
    });
  });

  describe("a path inside the distributed package", () => {
    const it = test.extend("entry", () =>
      matchingRestrictedTarget({
        entries: [{ module: "retired-lib", exports: [], allowedPositions: [], substitute }],
        forwarded: { specifier: "retired-lib/deep/inner.js", exported: null },
      }));

    it("reaches the same entry", ({ entry }) => {
      expect(entry).toStrictEqual({
        module: "retired-lib",
        exports: [],
        allowedPositions: [],
        substitute,
      });
    });
  });

  describe("a package whose name merely begins with the restricted name", () => {
    const it = test.extend("entry", () =>
      matchingRestrictedTarget({
        entries: [{ module: "retired-lib", exports: [], allowedPositions: [], substitute }],
        forwarded: { specifier: "retired-lib-extra", exported: null },
      }));

    it("is a separate name", ({ entry }) => {
      expect(entry).toBe(null);
    });
  });

  describe("an entry naming exports", () => {
    describe("an export outside the named list", () => {
      const it = test.extend("entry", () =>
        matchingRestrictedTarget({
          entries: [
            { module: "node:fs", exports: ["readFileSync"], allowedPositions: [], substitute },
          ],
          forwarded: { specifier: "node:fs", exported: "writeFileSync" },
        }));

      it("is left alone", ({ entry }) => {
        expect(entry).toBe(null);
      });
    });

    describe("the export it names", () => {
      const it = test.extend("entry", () =>
        matchingRestrictedTarget({
          entries: [
            { module: "node:fs", exports: ["readFileSync"], allowedPositions: [], substitute },
          ],
          forwarded: { specifier: "node:fs", exported: "readFileSync" },
        }));

      it("is matched", ({ entry }) => {
        expect(entry).toStrictEqual({
          module: "node:fs",
          exports: ["readFileSync"],
          allowedPositions: [],
          substitute,
        });
      });
    });

    describe("a forward that names no export", () => {
      const it = test.extend("entry", () =>
        matchingRestrictedTarget({
          entries: [
            { module: "node:fs", exports: ["readFileSync"], allowedPositions: [], substitute },
          ],
          forwarded: { specifier: "node:fs", exported: null },
        }));

      it("carries every named export with it", ({ entry }) => {
        expect(entry).toStrictEqual({
          module: "node:fs",
          exports: ["readFileSync"],
          allowedPositions: [],
          substitute,
        });
      });
    });
  });
});

describe("entriesInForceAt", () => {
  describe("an entry read at a position it does not allow", () => {
    const it = test.extend("entries", () =>
      entriesInForceAt({
        entries: [
          { module: "retired-lib", exports: [], allowedPositions: ["owner/**"], substitute },
        ],
        file: resolve("/repo", "reader", "reader.ts").split("/").join(sep),
        cwd: "/repo",
      }));

    it("stays in force", ({ entries }) => {
      expect(entries).toStrictEqual([
        { module: "retired-lib", exports: [], allowedPositions: ["owner/**"], substitute },
      ]);
    });
  });

  describe("an entry read at a position it allows", () => {
    const it = test.extend("entries", () =>
      entriesInForceAt({
        entries: [
          { module: "retired-lib", exports: [], allowedPositions: ["owner/**"], substitute },
        ],
        file: resolve("/repo", "owner", "reader.ts").split("/").join(sep),
        cwd: "/repo",
      }));

    it("falls out of force", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });
});

describe("restrictedTargetsFrom", () => {
  describe("a row missing the name of what it restricts", () => {
    const it = test.extend("entries", () =>
      restrictedTargetsFrom([{ restricted: [{ substitute }] }]));

    it("is no entry", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("a row missing the instruction that replaces it", () => {
    const it = test.extend("entries", () =>
      restrictedTargetsFrom([{ restricted: [{ module: "retired-lib" }] }]));

    it("is no entry", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("a row naming a module and its replacement", () => {
    const it = test.extend("entries", () =>
      restrictedTargetsFrom([
        { restricted: [{ module: "retired-lib", exports: ["readFile"], substitute }] },
      ]));

    it("is read whole", ({ entries }) => {
      expect(entries).toStrictEqual([
        { module: "retired-lib", exports: ["readFile"], allowedPositions: [], substitute },
      ]);
    });
  });

  describe("options carrying no entries at all", () => {
    const it = test.extend("entries", () => restrictedTargetsFrom([]));

    it("yield no entries", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("an entry written as bare text instead of a declaration", () => {
    const it = test.extend("entries", () =>
      restrictedTargetsFrom([{ restricted: ["retired-lib"] }]));

    it("is no entry", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("a row whose module name is empty", () => {
    const it = test.extend("entries", () =>
      restrictedTargetsFrom([{ restricted: [{ module: "", substitute }] }]));

    it("is no entry", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("a declaration written without the list around it", () => {
    const it = test.extend("entries", () =>
      restrictedTargetsFrom([{ restricted: { module: "retired-lib", substitute } }]));

    it("carries no entries", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("options naming only the prefixes they declare", () => {
    const it = test.extend("entries", () =>
      restrictedTargetsFrom([{ internalAliases: [{ prefix: "~/", directory: "shared" }] }]));

    it("restrict nothing", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });
});

describe("internalAliasesFrom", () => {
  describe("a directory declared without the prefix standing for it", () => {
    const it = test.extend("aliases", () =>
      internalAliasesFrom([{ internalAliases: [{ directory: "shared" }] }]));

    it("is no alias", ({ aliases }) => {
      expect(aliases).toStrictEqual([]);
    });
  });

  describe("a prefix declared with the directory it stands for", () => {
    const it = test.extend("aliases", () =>
      internalAliasesFrom([{ internalAliases: [{ prefix: "~/", directory: "src" }] }]));

    it("is read whole", ({ aliases }) => {
      expect(aliases).toStrictEqual([{ prefix: "~/", directory: "src" }]);
    });
  });

  describe("a prefix declared without the directory it stands for", () => {
    const it = test.extend("aliases", () =>
      internalAliasesFrom([{ internalAliases: [{ prefix: "~/" }] }]));

    it("is no alias", ({ aliases }) => {
      expect(aliases).toStrictEqual([]);
    });
  });

  describe("a prefix written as bare text instead of a declaration", () => {
    const it = test.extend("aliases", () => internalAliasesFrom([{ internalAliases: ["~/"] }]));

    it("is no alias", ({ aliases }) => {
      expect(aliases).toStrictEqual([]);
    });
  });

  describe("a prefix spelled as an empty string", () => {
    const it = test.extend("aliases", () =>
      internalAliasesFrom([{ internalAliases: [{ prefix: "", directory: "src" }] }]));

    it("stands for nothing and is no alias", ({ aliases }) => {
      expect(aliases).toStrictEqual([]);
    });
  });
});

describe("aliasedSpecifierIn", () => {
  describe("a declared prefix", () => {
    const it = test.extend("aliasedPath", () =>
      aliasedSpecifierIn({
        specifier: "~/forward.ts",
        aliases: [{ prefix: "~/", directory: "shared" }],
        workspaceRoot: resolve("/repo"),
      }));

    it("resolves to the directory it stands for", ({ aliasedPath }) => {
      expect(aliasedPath).toBe(resolve("/repo", "shared", "forward.ts"));
    });
  });

  describe("a specifier matching no declared prefix", () => {
    const it = test.extend("aliasedPath", () =>
      aliasedSpecifierIn({
        specifier: "@other/forward.ts",
        aliases: [{ prefix: "~/", directory: "shared" }],
        workspaceRoot: resolve("/repo"),
      }));

    it("stands for nothing", ({ aliasedPath }) => {
      expect(aliasedPath).toBe(null);
    });
  });
});

describe("RESTRICTED_TARGET_SCHEMA", () => {
  describe("the options schema", () => {
    const it = test.extend("schema", () => RESTRICTED_TARGET_SCHEMA);

    it("declares the entry shape and refuses any other key", ({ schema }) => {
      expect(schema).toStrictEqual([
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
});
