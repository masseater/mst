import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import {
  STRICT_RULE,
  STRICT_SOURCE,
  UNCONFIGURED_OWNERSHIP_POLICY,
} from "./canonical-literal-rule-test-fixture.ts";

const OUT_OF_SCOPE_IMPORT_ROOT = findWorkspaceRoot(process.cwd());
const OUT_OF_SCOPE_CONSUMER = join(
  OUT_OF_SCOPE_IMPORT_ROOT,
  "packages/dont-review-it/src/lint/oxlint/rules/consumer.ts",
);
const OUT_OF_SCOPE_SPECIFIER = "./canonical-literal-owner-exemption.test.ts";

describe("dont-review-it/no-strict-canonical-literal-use--use-canonical-import", () => {
  testLintRule(STRICT_RULE, {
    valid: [
      {
        name: "a literal that no vocabulary declares is not a use site",
        code: 'const label = "unlisted";',
        filename: STRICT_SOURCE,
      },
      {
        name: "a template literal that interpolates has no fixed spelling",
        code: "export const label = (prefix: string) => `${prefix}draft`;",
        filename: STRICT_SOURCE,
      },
      {
        name: "a test source is out of scope",
        code: 'const status = "draft";',
        filename: "/repo/packages/order/src/status.test.ts",
      },
      {
        name: "a fixture directory is out of scope",
        code: 'const status = "draft";',
        filename: "/repo/packages/order/src/__fixtures__/order.ts",
      },
      {
        name: "a mock directory is out of scope",
        code: 'const status = "draft";',
        filename: "/repo/packages/order/src/__mocks__/order.ts",
      },
      {
        name: "a tests directory is out of scope",
        code: 'const status = "draft";',
        filename: "/repo/packages/order/tests/order.ts",
      },
      {
        name: "a story source is out of scope",
        code: 'const status = "draft";',
        filename: "/repo/apps/website/src/Order.stories.ts",
      },
      {
        name: "production may import another production module",
        code: 'import { createCanonicalLiteralVisitor } from "./canonical-literal-candidate.ts";\nconsume(createCanonicalLiteralVisitor);',
        cwd: OUT_OF_SCOPE_IMPORT_ROOT,
        filename: OUT_OF_SCOPE_CONSUMER,
      },
    ],
    invalid: [
      {
        name: "a string literal that a vocabulary declares is reported",
        code: 'const status = "published";',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an ordinary require call argument is a vocabulary use",
        code: 'const legacy = require("draft");',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      ...[
        {
          name: "a production import cannot receive values from a fixture",
          code: `import { fixture } from "${OUT_OF_SCOPE_SPECIFIER}";\nconsume(fixture);`,
        },
        {
          name: "a production re-export cannot expose a fixture",
          code: `export { fixture } from "${OUT_OF_SCOPE_SPECIFIER}";`,
        },
        {
          name: "a production dynamic import cannot load a fixture",
          code: `export const fixture = import("${OUT_OF_SCOPE_SPECIFIER}");`,
        },
        {
          name: "a dynamic import source alias cannot load a fixture",
          code: `const source = "${OUT_OF_SCOPE_SPECIFIER}";\nexport const fixture = import(source);`,
        },
        {
          name: "a statically concatenated dynamic import cannot load a fixture",
          code: 'export const fixture = import("./canonical-literal-owner-exemption" + ".test.ts");',
        },
        {
          name: "a URL relative to import meta cannot load a fixture",
          code: `export const fixture = import(new URL("${OUT_OF_SCOPE_SPECIFIER}", import.meta.url));`,
        },
        {
          name: "a conditional dynamic import cannot retain a fixture branch",
          code: 'export const fixture = import(enabled ? "./canonical-literal-candidate.ts" : "./canonical-literal-owner-exemption.test.ts");',
        },
        {
          name: "a production require cannot load a fixture",
          code: `export const fixture = require("${OUT_OF_SCOPE_SPECIFIER}");`,
        },
        {
          name: "a require alias cannot load a fixture",
          code: `const load = require;\nexport const fixture = load("${OUT_OF_SCOPE_SPECIFIER}");`,
        },
        {
          name: "a require source alias cannot load a fixture",
          code: `const source = "${OUT_OF_SCOPE_SPECIFIER}";\nexport const fixture = require(source);`,
        },
        {
          name: "a require source property cannot load a fixture",
          code: `const sources = { fixture: "${OUT_OF_SCOPE_SPECIFIER}" };\nexport const fixture = require(sources.fixture);`,
        },
        {
          name: "module require cannot load a fixture",
          code: `export const fixture = module.require("${OUT_OF_SCOPE_SPECIFIER}");`,
        },
        {
          name: "create require cannot load a fixture",
          code: `import { createRequire } from "node:module";\nconst load = createRequire(import.meta.url);\nexport const fixture = load("${OUT_OF_SCOPE_SPECIFIER}");`,
        },
        {
          name: "an immediately created require cannot load a fixture",
          code: `import { createRequire } from "node:module";\nexport const fixture = createRequire(import.meta.url)("${OUT_OF_SCOPE_SPECIFIER}");`,
        },
        {
          name: "require call cannot load a fixture",
          code: `export const fixture = require.call(module, "${OUT_OF_SCOPE_SPECIFIER}");`,
        },
        {
          name: "require apply cannot load a fixture",
          code: `export const fixture = Reflect.apply(require, null, ["${OUT_OF_SCOPE_SPECIFIER}"]);`,
          errors: [
            { messageId: "canonicalValueLiteral" },
            { messageId: "productionImportsOutOfScopeSource" },
          ],
        },
        {
          name: "a bound require cannot load a fixture",
          code: `const load = require.bind(module);\nexport const fixture = load("${OUT_OF_SCOPE_SPECIFIER}");`,
        },
        {
          name: "a require with a bound source cannot load a fixture",
          code: `const load = require.bind(module, "${OUT_OF_SCOPE_SPECIFIER}");\nexport const fixture = load();`,
        },
        {
          name: "a statically concatenated require cannot load a fixture",
          code: 'export const fixture = require("./canonical-literal-owner-exemption" + ".test.ts");',
        },
        {
          name: "a node path join from a named import cannot load a fixture",
          code: 'import { join } from "node:path";\nexport const fixture = require(join("..", "rules", "canonical-literal-owner-exemption.test.ts"));',
        },
        {
          name: "a node path join from require cannot load a fixture",
          code: 'const path = require("node:path");\nexport const fixture = require(path.join("..", "rules", "canonical-literal-owner-exemption.test.ts"));',
        },
        {
          name: "a String raw tag cannot load a fixture",
          code: "export const fixture = require(String.raw`./canonical-literal-owner-exemption.test.ts`);",
        },
        {
          name: "a static String slice cannot load a fixture",
          code: 'export const fixture = require("./canonical-literal-owner-exemption.test.ts".slice(0));',
        },
        {
          name: "a production import-equals cannot load a fixture",
          code: `import fixture = require("${OUT_OF_SCOPE_SPECIFIER}");\nexport { fixture };`,
        },
        {
          name: "a production import type cannot load a fixture",
          code: `export type Fixture = typeof import("${OUT_OF_SCOPE_SPECIFIER}");`,
        },
      ].map(({ code, errors, name }) => ({
        name,
        code,
        cwd: OUT_OF_SCOPE_IMPORT_ROOT,
        filename: OUT_OF_SCOPE_CONSUMER,
        errors: errors ?? [{ messageId: "productionImportsOutOfScopeSource" }],
      })),
      {
        name: "a literal type node is reported",
        code: 'type Status = "published";',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a numeric literal that a vocabulary declares is reported",
        code: "const retries = 3;",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a negative numeric literal that a vocabulary declares is reported once",
        code: "const retries = -1;",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a negative numeric literal type node is reported once",
        code: "type Budget = -1;",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a const assertion cannot hide the operand of a negative numeric literal",
        code: "const retries = -(1 as const);",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a nested unary plus cannot hide a negative numeric literal",
        code: "const retries = -(+1);",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a non-null assertion cannot hide a negative numeric literal",
        code: "const retries = -(1!);",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a boolean literal that a vocabulary declares is reported",
        code: "const mode = true;",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a null literal that a vocabulary declares is reported",
        code: "const mode = null;",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a null type keyword that a vocabulary declares is reported",
        code: "type SyncMode = null;",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a null parameter type cannot hide behind a wider union",
        code: "export const sync = (mode: null | string) => mode;",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a template literal without substitution is the same spelling written another way",
        code: "const status = `published`;",
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a value that two concepts own is reported once with both concepts listed",
        code: 'const status = "draft";',
        filename: STRICT_SOURCE,
        errors: [
          {
            messageId: "canonicalValueLiteral",
            data: {
              value: '"draft"',
              concepts:
                "article.status declared in packages/article/src/status.ts; order.status exported from @mst/order",
              ownershipPolicy: UNCONFIGURED_OWNERSHIP_POLICY,
            },
          },
        ],
      },
      {
        name: "an unconfigured ownership policy says so instead of inventing one",
        code: 'const status = "published";',
        filename: STRICT_SOURCE,
        errors: [
          {
            message:
              /Ownership policy: not configured \(set the ownershipPolicy option of this rule\)\./u,
          },
        ],
      },
      {
        name: "the configured ownership policy replaces the unset wording in the report",
        code: 'const status = "published";',
        filename: STRICT_SOURCE,
        options: [{ ownershipPolicy: "Operational vocabularies belong to the service package." }],
        errors: [
          {
            messageId: "canonicalValueLiteral",
            data: {
              value: '"published"',
              concepts: "order.status exported from @mst/order",
              ownershipPolicy: "Operational vocabularies belong to the service package.",
            },
          },
        ],
      },
      {
        name: "an equality comparison is a use site",
        code: 'export const isLive = (status: string) => status === "published";',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a switch case is a use site",
        code: 'export const rank = (status: string) => {\n  switch (status) {\n    case "published":\n      return 1;\n    default:\n      return 0;\n  }\n};',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a literal argument is a use site",
        code: 'export const emit = (send: (status: string) => void) => send("published");',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a union written in a parameter position reports every member",
        code: 'export const rank = (status: "draft" | "published") => status;',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a computed member access is a use site",
        code: 'export const read = (table: Record<string, number>) => table["published"];',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "computed property keys use their JavaScript string identity",
        code: "export const read = (table: Record<string, number>) => [table[-1], table[1], table[true], table[null]];",
        filename: STRICT_SOURCE,
        errors: [
          { messageId: "canonicalValueLiteral" },
          { messageId: "canonicalValueLiteral" },
          { messageId: "canonicalValueLiteral" },
          { messageId: "canonicalValueLiteral" },
        ],
      },
      {
        name: "static JSX text is a vocabulary use site",
        code: "export const status = <span>published</span>;",
        filename: "/repo/packages/order/src/status.tsx",
        languageOptions: { parserOptions: { lang: "tsx" } },
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "multiline JSX whitespace cannot hide a vocabulary use site",
        code: "export const status = <span>\n  published\n</span>;",
        filename: "/repo/packages/order/src/status.tsx",
        languageOptions: { parserOptions: { lang: "tsx" } },
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a JSX text character reference has its runtime spelling",
        code: "export const status = <span>publ&#105;shed</span>;",
        filename: "/repo/packages/order/src/status.tsx",
        languageOptions: { parserOptions: { lang: "tsx" } },
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a JSX attribute character reference has its runtime spelling",
        code: 'export const status = <Panel status="publ&#105;shed" />;',
        filename: "/repo/packages/order/src/status.tsx",
        languageOptions: { parserOptions: { lang: "tsx" } },
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "static string concatenation is reported at the complete expression",
        code: 'consume("dra" + "ft");',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "nested static string concatenation is reported once",
        code: 'consume("d" + "ra" + "ft");',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
    ],
  });
});
