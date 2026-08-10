import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireReExportOnlyFiles } from "./require-re-export-only-files--move-declaration-to-owning-module.ts";

describe("dont-review-it/require-re-export-only-files--move-declaration-to-owning-module", () => {
  testLintRule(requireReExportOnlyFiles, {
    valid: [
      {
        name: "a named re-export names the module that owns the declaration",
        code: 'export { total } from "./total.ts";',
        filename: "src/index.ts",
      },
      {
        name: "a type only re-export names the module that owns the type",
        code: 'export type { Total } from "./total.ts";',
        filename: "src/index.ts",
      },
      {
        name: "a star re-export names the module it forwards",
        code: 'export * from "./total.ts";',
        filename: "src/index.ts",
      },
      {
        name: "a namespaced star re-export names the module it forwards",
        code: 'export * as total from "./total.ts";',
        filename: "src/index.ts",
      },
      {
        name: "a renamed default re-export names the module that owns the declaration",
        code: 'export { default as total } from "./total.ts";',
        filename: "src/index.ts",
      },
      {
        name: "several re-exports stand together",
        code: 'export { total } from "./total.ts";\nexport type { Total } from "./total.ts";\nexport * from "./sum.ts";',
        filename: "src/index.ts",
      },
      {
        name: "a module that is not a public surface owns its declarations",
        code: "export const total = 1;",
      },
      {
        name: "a file name ending in index.ts is not a public surface unless it is index.ts",
        code: "export const total = 1;",
        filename: "src/print-index.ts",
      },
    ],
    invalid: [
      {
        name: "an exported declaration on the public surface is reported",
        code: "export const total = 1;",
        filename: "src/index.ts",
        errors: [{ messageId: "declarationInPublicSurface" }],
      },
      {
        name: "a declaration that is not exported is reported",
        code: "const total = 1;",
        filename: "src/index.ts",
        errors: [{ messageId: "declarationInPublicSurface" }],
      },
      {
        name: "a function declaration on the public surface is reported",
        code: "export function total() {\n  return 1;\n}",
        filename: "src/index.ts",
        errors: [{ messageId: "declarationInPublicSurface" }],
      },
      {
        name: "a type alias on the public surface is reported",
        code: "export type Total = number;",
        filename: "src/index.ts",
        errors: [{ messageId: "declarationInPublicSurface" }],
      },
      {
        name: "a default export on the public surface is reported",
        code: "export default { total: 1 };",
        filename: "src/index.ts",
        errors: [{ messageId: "declarationInPublicSurface" }],
      },
      {
        name: "a statement that runs on import is reported",
        code: "registerAll();",
        filename: "src/index.ts",
        errors: [{ messageId: "declarationInPublicSurface" }],
      },
      {
        name: "a directive prologue is reported",
        code: '"use strict";\nexport * from "./total.ts";',
        filename: "src/index.ts",
        errors: [{ messageId: "declarationInPublicSurface" }],
      },
      {
        name: "a side effect import is reported",
        code: 'import "./register-all.ts";',
        filename: "src/index.ts",
        errors: [{ messageId: "forwardingWithoutSource" }],
      },
      {
        name: "an import paired with a source-less export is reported on both statements",
        code: 'import { total } from "./total.ts";\nexport { total };',
        filename: "src/index.ts",
        errors: [
          { messageId: "forwardingWithoutSource" },
          { messageId: "forwardingWithoutSource" },
        ],
      },
      {
        name: "only the statement that is not a re-export is reported",
        code: 'export { total } from "./total.ts";\nexport const sum = 2;\nexport * from "./count.ts";',
        filename: "src/index.ts",
        errors: [{ messageId: "declarationInPublicSurface" }],
      },
      {
        name: "the public surface is found by file name at any depth",
        code: "export const total = 1;",
        filename: "packages/dont-review-it/src/lint/oxlint/index.ts",
        errors: [{ messageId: "declarationInPublicSurface" }],
      },
    ],
  });
});
