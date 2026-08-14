import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noBarrelImport } from "./no-barrel-import--import-from-the-owning-module.ts";

describe("dont-review-it/no-barrel-import--import-from-the-owning-module", () => {
  testLintRule(noBarrelImport, {
    valid: [
      {
        name: "naming the module that declares the binding is the shape this rule asks for",
        documented: true,
        code: "import { total } from './total.ts';",
      },
      {
        name: "a package outside this repository is beyond what the importer can rearrange",
        code: "import { chunk } from 'es-toolkit';",
      },
      {
        name: "a package entry spelled as its own index is still that package's business",
        code: "import { chunk } from 'es-toolkit/index.js';",
      },
      {
        name: "a file whose stem only starts with the re-export stem is a module of its own",
        code: "import { build } from './indexer.ts';",
      },
      {
        name: "a specifier without an extension names a module this rule cannot resolve",
        code: "import { total } from './totals';",
      },
      {
        name: "taking types alone leaves nothing behind once the build is done",
        documented: true,
        code: "import type { Total } from './totals/index.ts';",
      },
      {
        name: "taking types spelled inline is the same as taking types",
        code: "import { type Total } from './totals/index.ts';",
      },
      {
        name: "forwarding types alone through a re-export module carries no value",
        code: "export type { Total } from './totals/index.ts';",
      },
      {
        name: "forwarding a whole re-export module as types alone carries no value either",
        code: "export type * from './totals/index.ts';",
      },
      {
        name: "an export that names no module has no specifier to read",
        code: "export const total = 1;",
      },
      {
        name: "a specifier decided while the program runs is not a specifier this rule can read",
        code: "const chosen = './totals/index.ts';\nconst totals = await import(chosen);",
      },
      {
        name: "a specifier that is not written as text names no module either",
        code: "const totals = await import(1);",
      },
    ],
    invalid: [
      {
        name: "naming a re-export module by its file is reported",
        documented: true,
        code: "import { total } from './totals/index.ts';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "naming a re-export module without its extension is the same specifier",
        code: "import { total } from './totals/index';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "naming the current directory reaches its re-export module",
        code: "import { total } from '.';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "naming the parent directory reaches its re-export module",
        code: "import { total } from '..';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "a specifier that ends at a directory reaches that directory's re-export module",
        code: "import { total } from './totals/';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "a re-export module written with another extension is the same module",
        code: "import { Total } from '../index.tsx';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "a specifier that climbs back out at its last segment reaches a directory",
        code: "import { total } from './totals/..';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "importing for the side effect alone still runs the whole re-export module",
        documented: true,
        code: "import './totals/index.ts';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "taking the default through a re-export module is taking a value",
        code: "import totals from './totals/index.ts';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "binding the whole re-export module to a namespace takes every value in it",
        code: "import * as totals from './totals/index.ts';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "one value among taken types is enough to reach the values",
        code: "import { total, type Total } from './totals/index.ts';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "forwarding values through a re-export module is reported",
        code: "export { total } from './totals/index.ts';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "forwarding a whole re-export module is reported",
        code: "export * from './totals/index.ts';",
        errors: [{ messageId: "barrelImport" }],
      },
      {
        name: "asking for a re-export module while the program runs reaches the same module",
        code: "const totals = await import('./totals/index.ts');",
        errors: [{ messageId: "barrelImport" }],
      },
    ],
  });
});
