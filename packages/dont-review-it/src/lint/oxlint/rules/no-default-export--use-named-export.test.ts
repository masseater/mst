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
        name: "a type re-export under the defined name is not a default export",
        code: "export type { Total } from './total.ts';",
      },
      {
        name: "forwarding a whole module keeps every name it already had",
        code: "export * from './total.ts';",
      },
      {
        name: "a namespace re-export under a name of its own is not a default export",
        code: "export * as total from './total.ts';",
      },
      {
        name: "giving an outward name to another module's default is the way across the boundary",
        code: "export { default as total } from 'external-package';",
      },
      {
        name: "reading a default from elsewhere is the importing side and not this rule's business",
        code: "import total from 'external-package';\nexport { total };",
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
        name: "renaming a local binding to default on the way out is reported",
        code: "const total = 1;\nexport { total as default };",
        errors: [{ messageId: "defaultAliasReExport" }],
      },
      {
        name: "renaming another module's export to default is reported",
        code: "export { total as default } from './total.ts';",
        errors: [{ messageId: "defaultAliasReExport" }],
      },
      {
        name: "spelling the outward default as a string literal is the same violation",
        code: "export { total as 'default' } from './total.ts';",
        errors: [{ messageId: "defaultAliasReExport" }],
      },
      {
        name: "forwarding another module's default under the name default is reported",
        code: "export { default } from 'external-package';",
        errors: [{ messageId: "defaultAliasReExport" }],
      },
      {
        name: "a type sent out under the name default is reported",
        code: "export type { Total as default } from './total.ts';",
        errors: [{ messageId: "defaultAliasReExport" }],
      },
      {
        name: "only the specifier that goes out as default is reported",
        code: "export { total, sum as default, count } from './total.ts';",
        errors: [{ messageId: "defaultAliasReExport" }],
      },
      {
        name: "binding a whole namespace to the name default is reported on its own message",
        code: "export * as default from './total.ts';",
        errors: [{ messageId: "namespaceDefaultReExport" }],
      },
      {
        name: "spelling the namespace binding as a string literal is the same violation",
        code: "export * as 'default' from './total.ts';",
        errors: [{ messageId: "namespaceDefaultReExport" }],
      },
      {
        name: "an export assignment is reported on its own message",
        code: "const total = 1;\nexport = total;",
        errors: [{ messageId: "exportAssignment" }],
      },
      {
        name: "the oxlint plugin entry carries no exemption of its own",
        code: "const plugin = { meta: { name: 'x' }, rules: {} };\nexport default plugin;",
        filename: "/repo/packages/dont-review-it/src/plugin.ts",
        errors: [{ messageId: "defaultExport" }],
      },
      {
        name: "the root build config carries no exemption of its own",
        code: "export default { lint: {} };",
        filename: "/repo/vite.config.ts",
        errors: [{ messageId: "defaultExport" }],
      },
      {
        name: "a workspace build config carries no exemption of its own",
        code: "export default { pack: {} };",
        filename: "/repo/apps/website/vite.config.ts",
        errors: [{ messageId: "defaultExport" }],
      },
    ],
  });
});
