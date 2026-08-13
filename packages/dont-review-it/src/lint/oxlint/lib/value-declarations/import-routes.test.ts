import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { importRoutesIn } from "./import-routes.ts";

const RELATIVE_PATH = "packages/one/src/use.ts";

describe("importRoutesIn", () => {
  describe("a named import", () => {
    const it = test.extend("routesOfNamedImport", () =>
      importRoutesIn({
        body: parseSync(RELATIVE_PATH, `import { readFileSync } from "node:fs";`).program.body,
        relativePath: RELATIVE_PATH,
      }));

    it("routes a named import to the module it came from", ({ routesOfNamedImport }) => {
      expect(routesOfNamedImport).toStrictEqual(
        new Map([["readFileSync", "node:fs#readFileSync"]]),
      );
    });
  });

  describe("an import taken under an alias", () => {
    const it = test.extend("routesOfAliasedImport", () =>
      importRoutesIn({
        body: parseSync(RELATIVE_PATH, `import { readFileSync as slurp } from "node:fs";`).program
          .body,
        relativePath: RELATIVE_PATH,
      }));

    it("routes an aliased import to the name the module exports", ({ routesOfAliasedImport }) => {
      expect(routesOfAliasedImport).toStrictEqual(new Map([["slurp", "node:fs#readFileSync"]]));
    });
  });

  describe("an import taken under a quoted name", () => {
    const it = test.extend("routesOfQuotedImport", () =>
      importRoutesIn({
        body: parseSync(RELATIVE_PATH, `import { "read-file" as slurp } from "node:fs";`).program
          .body,
        relativePath: RELATIVE_PATH,
      }));

    it("routes an import taken under a quoted name to that name", ({ routesOfQuotedImport }) => {
      expect(routesOfQuotedImport).toStrictEqual(new Map([["slurp", "node:fs#read-file"]]));
    });
  });

  describe("a default import", () => {
    const it = test.extend("routesOfDefaultImport", () =>
      importRoutesIn({
        body: parseSync(RELATIVE_PATH, `import base from "./base.ts";`).program.body,
        relativePath: RELATIVE_PATH,
      }));

    it("routes a default import to the default entry of the module", ({
      routesOfDefaultImport,
    }) => {
      expect(routesOfDefaultImport).toStrictEqual(
        new Map([["base", "packages/one/src/base#default"]]),
      );
    });
  });

  describe("an import of a whole module", () => {
    const it = test.extend("routesOfWholeModuleImport", () =>
      importRoutesIn({
        body: parseSync(RELATIVE_PATH, `import * as everything from "../shared/all.ts";`).program
          .body,
        relativePath: RELATIVE_PATH,
      }));

    it("routes a whole-module import to the module itself", ({ routesOfWholeModuleImport }) => {
      expect(routesOfWholeModuleImport).toStrictEqual(
        new Map([["everything", "packages/one/shared/all#*"]]),
      );
    });
  });

  describe("an import reached from the owning package", () => {
    const it = test.extend("routesReachedFromTheOwningPackage", () =>
      importRoutesIn({
        body: parseSync(RELATIVE_PATH, `import { helper } from "./deep/helper.ts";`).program.body,
        relativePath: RELATIVE_PATH,
      }));

    it("routes an import reached from the owning package to the module it names", ({
      routesReachedFromTheOwningPackage,
    }) => {
      expect(routesReachedFromTheOwningPackage).toStrictEqual(
        new Map([["helper", "packages/one/src/deep/helper#helper"]]),
      );
    });
  });

  describe("an import reached from another package", () => {
    const it = test.extend("routesReachedFromAnotherPackage", () =>
      importRoutesIn({
        body: parseSync(
          "packages/two/src/use.ts",
          `import { helper } from "../../one/src/deep/helper.ts";`,
        ).program.body,
        relativePath: "packages/two/src/use.ts",
      }));

    it("routes an import reached from another package to that same module", ({
      routesReachedFromAnotherPackage,
    }) => {
      expect(routesReachedFromAnotherPackage).toStrictEqual(
        new Map([["helper", "packages/one/src/deep/helper#helper"]]),
      );
    });
  });

  describe("a statement that imports nothing", () => {
    const it = test.extend("routesOfImportlessStatement", () =>
      importRoutesIn({
        body: parseSync(RELATIVE_PATH, `export const seed = 1;`).program.body,
        relativePath: RELATIVE_PATH,
      }));

    it("leaves a statement that imports nothing out of the routes", ({
      routesOfImportlessStatement,
    }) => {
      expect(routesOfImportlessStatement).toStrictEqual(new Map([]));
    });
  });
});
