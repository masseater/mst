import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noDefaultExport } from "./no-default-export--use-named-export.ts";

describe("dont-review-it/no-default-export--use-named-export", () => {
  testLintRule(noDefaultExport, {
    valid: [
      {
        name: "a named export keeps the defined name at the module boundary",
        code: "export const total = 1 + 2;",
      },
      {
        name: "re-exporting under the defined name is not a default export",
        code: "export { total } from './total.ts';",
      },
      {
        name: "the oxlint plugin entry is required to default export whatever directory it sits in",
        code: "const plugin = { meta: { name: 'x' }, rules: {} };\nexport default plugin;",
        filename: "/repo/packages/dont-review-it/src/plugin.ts",
      },
      {
        name: "the root build config is required to default export",
        code: "export default { lint: {} };",
        filename: "/repo/vite.config.ts",
      },
      {
        name: "a workspace build config is required to default export",
        code: "export default { pack: {} };",
        filename: "/repo/apps/website/vite.config.ts",
      },
    ],
    invalid: [
      {
        name: "a default exported expression is reported",
        code: "const total = 1 + 2;\nexport default total;",
        errors: [{ messageId: "defaultExport" }],
      },
      {
        name: "a default exported function declaration is reported",
        code: "export default function total() {\n  return 1;\n}",
        errors: [{ messageId: "defaultExport" }],
      },
      {
        name: "a default exported class declaration is reported",
        code: "export default class Total {}",
        errors: [{ messageId: "defaultExport" }],
      },
      {
        name: "a default exported anonymous expression is reported",
        code: "export default () => 1;",
        errors: [{ messageId: "defaultExport" }],
      },
      {
        name: "a file whose name merely ends with plugin.ts is not exempt",
        code: "export default { meta: { name: 'x' } };",
        filename: "/repo/packages/dont-review-it/src/my-plugin.ts",
        errors: [{ messageId: "defaultExport" }],
      },
      {
        name: "a file named plugin.ts under a nested directory is exempt only by that exact name",
        code: "export default { meta: { name: 'x' } };",
        filename: "/repo/packages/dont-review-it/src/plugin.entry.ts",
        errors: [{ messageId: "defaultExport" }],
      },
      {
        name: "a config file with a different extension is not exempt",
        code: "export default { lint: {} };",
        filename: "/repo/vite.config.js",
        errors: [{ messageId: "defaultExport" }],
      },
      {
        name: "a directory named plugin.ts does not exempt the file inside it",
        code: "export default { meta: { name: 'x' } };",
        filename: "/repo/plugin.ts/entry.ts",
        errors: [{ messageId: "defaultExport" }],
      },
    ],
  });
});
