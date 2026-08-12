import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { importRoutesIn } from "./import-routes.ts";

const RELATIVE_PATH = "packages/one/src/use.ts";

const routesIn = (source: string): Readonly<Record<string, string>> =>
  Object.fromEntries(
    importRoutesIn({
      body: parseSync(RELATIVE_PATH, source).program.body,
      relativePath: RELATIVE_PATH,
    }),
  );

describe("importRoutesIn", () => {
  test("routes a named import to the module it came from", () => {
    expect(routesIn(`import { readFileSync } from "node:fs";`)).toStrictEqual({
      readFileSync: "node:fs#readFileSync",
    });
  });

  test("routes an aliased import to the name the module exports", () => {
    expect(routesIn(`import { readFileSync as slurp } from "node:fs";`)).toStrictEqual({
      slurp: "node:fs#readFileSync",
    });
  });

  test("routes an import taken under a quoted name to that name", () => {
    expect(routesIn(`import { "read-file" as slurp } from "node:fs";`)).toStrictEqual({
      slurp: "node:fs#read-file",
    });
  });

  test("routes a default import to the default entry of the module", () => {
    expect(routesIn(`import base from "./base.ts";`)).toStrictEqual({
      base: "packages/one/src/base#default",
    });
  });

  test("routes a whole-module import to the module itself", () => {
    expect(routesIn(`import * as everything from "../shared/all.ts";`)).toStrictEqual({
      everything: "packages/one/shared/all#*",
    });
  });

  test("gives two files importing one module through different paths the same route", () => {
    const here = importRoutesIn({
      body: parseSync(RELATIVE_PATH, `import { helper } from "./deep/helper.ts";`).program.body,
      relativePath: RELATIVE_PATH,
    });
    const away = importRoutesIn({
      body: parseSync(
        "packages/two/src/use.ts",
        `import { helper } from "../../one/src/deep/helper.ts";`,
      ).program.body,
      relativePath: "packages/two/src/use.ts",
    });

    expect(here.get("helper")).toBe(away.get("helper"));
  });

  test("leaves a statement that imports nothing out of the routes", () => {
    expect(routesIn(`export const seed = 1;`)).toStrictEqual({});
  });
});
