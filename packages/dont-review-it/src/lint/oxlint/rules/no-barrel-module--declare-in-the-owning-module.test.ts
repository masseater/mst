import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noBarrelModule } from "./no-barrel-module--declare-in-the-owning-module.ts";

describe("dont-review-it/no-barrel-module--declare-in-the-owning-module", () => {
  testLintRule(noBarrelModule, {
    valid: [
      {
        name: "a module that declares what it exports owns that binding",
        code: "export const total = 1 + 2;",
      },
      {
        name: "a module with nothing in it forwards nothing",
        code: "",
      },
      {
        name: "a re-export beside a declaration leaves the file with something of its own",
        documented: true,
        code: "export { sum } from './sum.ts';\nexport const total = 1;",
      },
      {
        name: "an import beside a re-export leaves the file with a statement that forwards nothing",
        code: "import './setup.ts';\nexport { sum } from './sum.ts';",
      },
      {
        name: "forwarding types alone leaves nothing behind once the build is done",
        documented: true,
        code: "export type { Total } from './total.ts';",
      },
      {
        name: "forwarding types spelled inline is the same as forwarding types",
        code: "export { type Total } from './total.ts';",
      },
      {
        name: "forwarding a whole module as types alone carries no value either",
        code: "export type * from './total.ts';",
      },
      {
        name: "a file the configuration excludes is left alone",
        code: "export { total } from './total.ts';",
        filename: "/repo/packages/library/src/index.ts",
        options: [{ exclude: ["packages/library/src/index.ts"] }],
      },
      {
        name: "options that exclude nothing leave the empty list in place",
        code: "export const total = 1;",
        options: [{}],
      },
    ],
    invalid: [
      {
        name: "a file holding one named re-export and nothing else is reported",
        documented: true,
        code: "export { total } from './total.ts';",
        errors: [{ messageId: "barrelModule" }],
      },
      {
        name: "a file holding one wildcard re-export and nothing else is reported",
        code: "export * from './total.ts';",
        errors: [{ messageId: "barrelModule" }],
      },
      {
        name: "a file holding several re-exports is reported once for the file",
        code: "export { total } from './total.ts';\nexport { sum } from './sum.ts';",
        errors: [{ messageId: "barrelModule" }],
      },
      {
        name: "a namespace re-export forwards the values under that name",
        code: "export * as totals from './total.ts';",
        errors: [{ messageId: "barrelModule" }],
      },
      {
        name: "one value among forwarded types is enough to carry values",
        documented: true,
        code: "export { total, type Total } from './total.ts';",
        errors: [{ messageId: "barrelModule" }],
      },
      {
        name: "a type re-export beside a value re-export leaves the values forwarded",
        code: "export type { Total } from './total.ts';\nexport { sum } from './sum.ts';",
        errors: [{ messageId: "barrelModule" }],
      },
      {
        name: "a file the configuration does not exclude is reported",
        code: "export { total } from './total.ts';",
        filename: "/repo/packages/library/src/models/index.ts",
        options: [{ exclude: ["packages/library/src/index.ts"] }],
        errors: [{ messageId: "barrelModule" }],
      },
    ],
  });
});
