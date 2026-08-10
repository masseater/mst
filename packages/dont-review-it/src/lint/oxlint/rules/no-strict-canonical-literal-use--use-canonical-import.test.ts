import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { buildCatalog, EMPTY_CANONICAL_VALUES_CATALOG } from "../lib/canonical-values/catalog.ts";
import { fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import { UNCONFIGURED_OWNERSHIP_POLICY } from "../lib/canonical-values/ownership-policy.ts";
import { createNoStrictCanonicalLiteralUseRule } from "./no-strict-canonical-literal-use--use-canonical-import.ts";

import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";

const entry = (
  conceptId: string,
  declarationPath: string,
  exportPath: string | null,
  values: readonly CanonicalValue[],
) => ({ conceptId, declarationPath, exportPath, values, fingerprint: fingerprintValues(values) });

const CATALOG = buildCatalog([
  entry("order.status", "packages/order/src/status.ts", "@mst/order", ["draft", "published"]),
  entry("article.status", "packages/article/src/status.ts", null, ["draft", "archived"]),
  entry("retry.budget", "packages/retry/src/budget.ts", "@mst/retry", [3, -1]),
  entry("sync.mode", "packages/sync/src/mode.ts", "@mst/sync", ["auto", true]),
]);

const SOURCE = "/repo/packages/order/src/order.ts";

const OWNER_SOURCE = "/repo/packages/order/src/status.ts";

const rule = createNoStrictCanonicalLiteralUseRule({ loadCatalog: () => CATALOG });

describe("dont-review-it/no-strict-canonical-literal-use--use-canonical-import", () => {
  testLintRule(rule, {
    valid: [
      {
        name: "a literal that no vocabulary declares is not a use site",
        code: 'const label = "unlisted";',
        filename: SOURCE,
      },
      {
        name: "the annotated value declaration the catalog registered is where the concept lives",
        code: '/** @canonical-values order.status */\nexport const ORDER_STATUS = ["draft", "published"] as const;',
        filename: OWNER_SOURCE,
      },
      {
        name: "the annotated type declaration the catalog registered is where the concept lives",
        code: '/** @canonical-values order.status */\nexport type OrderStatus = "draft" | "published";',
        filename: OWNER_SOURCE,
      },
      {
        name: "a non computed object property key is owned by the object, not by the vocabulary",
        code: 'const counts = { "draft": 0 };',
        filename: SOURCE,
      },
      {
        name: "a non computed type member key is owned by the type, not by the vocabulary",
        code: 'type Counts = { "draft": number };',
        filename: SOURCE,
      },
      {
        name: "a method signature name is owned by the type that declares it",
        code: 'interface Api { "draft"(): void }',
        filename: SOURCE,
      },
      {
        name: "an enum member name is a key, not a use site",
        code: 'enum Legacy { "draft" = 0 }',
        filename: SOURCE,
      },
      {
        name: "the key selector of Pick selects from a type that already owns the spelling",
        code: 'type Article = { draft: string; body: string };\ntype Head = Pick<Article, "draft">;',
        filename: SOURCE,
      },
      {
        name: "the key selector of Omit selects from a type that already owns the spelling",
        code: 'type Article = { draft: string; body: string };\ntype Rest = Omit<Article, "draft">;',
        filename: SOURCE,
      },
      {
        name: "a template literal in the key selector of Pick is judged by its position too",
        code: "type Article = { draft: string; body: string };\ntype Head = Pick<Article, `draft`>;",
        filename: SOURCE,
      },
      {
        name: "a module specifier names a package, not a member of a vocabulary",
        code: 'import { load } from "draft";\nexport const loader = load;',
        filename: SOURCE,
      },
      {
        name: "an imported name spelled as a string is a name, not a use site",
        code: 'import { "draft" as load } from "./loader.ts";\nexport const loader = load;',
        filename: SOURCE,
      },
      {
        name: "an exported name spelled as a string is a name, not a use site",
        code: 'const load = () => {};\nexport { load as "draft" };',
        filename: SOURCE,
      },
      {
        name: "an ambient module name is a module specifier",
        code: 'declare module "draft" {}',
        filename: SOURCE,
      },
      {
        name: "an import attribute is protocol syntax, not a use site",
        code: 'import table from "./table.json" with { type: "draft" };\nexport const loaded = table;',
        filename: SOURCE,
      },
      {
        name: "a template literal that interpolates has no fixed spelling",
        code: "export const label = (prefix: string) => `${prefix}draft`;",
        filename: SOURCE,
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
    ],
    invalid: [
      {
        name: "a string literal that a vocabulary declares is reported",
        code: 'const status = "published";',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a literal type node is reported",
        code: 'type Status = "published";',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a numeric literal that a vocabulary declares is reported",
        code: "const retries = 3;",
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a negative numeric literal that a vocabulary declares is reported once",
        code: "const retries = -1;",
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a negative numeric literal type node is reported once",
        code: "type Budget = -1;",
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a boolean literal that a vocabulary declares is reported",
        code: "const mode = true;",
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a template literal without substitution is the same spelling written another way",
        code: "const status = `published`;",
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a value that two concepts own is reported once with both concepts listed",
        code: 'const status = "draft";',
        filename: SOURCE,
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
        filename: SOURCE,
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
        filename: SOURCE,
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
        name: "a computed object property key is a use site",
        code: 'const counts = { ["published"]: 0 };',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a record type writes a new key set rather than selecting from one",
        code: 'type Counts = Record<"published", number>;',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "the source type argument of Pick is still checked",
        code: 'type Head = Pick<Record<"published", number>, "published">;',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "Exclude narrows a union instead of selecting keys, so its literal is a use site",
        code: 'import type { OrderStatus } from "@mst/order";\nexport type Live = Exclude<OrderStatus, "published">;',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an equality comparison is a use site",
        code: 'export const isLive = (status: string) => status === "published";',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a switch case is a use site",
        code: 'export const rank = (status: string) => {\n  switch (status) {\n    case "published":\n      return 1;\n    default:\n      return 0;\n  }\n};',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a literal argument is a use site",
        code: 'export const emit = (send: (status: string) => void) => send("published");',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a union written in a parameter position reports every member",
        code: 'export const rank = (status: "draft" | "published") => status;',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a computed member access is a use site",
        code: 'export const read = (table: Record<string, number>) => table["published"];',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "the file that declares one concept is still checked for another",
        code: '/** @canonical-values order.status */\nexport const ORDER_STATUS = ["draft", "published"] as const;\nexport const fallback = "archived";',
        filename: OWNER_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an annotation naming a concept the catalog registered elsewhere exempts nothing",
        code: '/** @canonical-values order.status */\nexport const ORDER_STATUS = ["draft", "published"] as const;',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an annotation naming a concept the catalog does not know exempts nothing",
        code: '/** @canonical-values totally.unrelated */\nexport const fallback = "published";',
        filename: OWNER_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an annotated enum is exempt only when the catalog attributes the concept here",
        code: '/** @canonical-values totally.unrelated */\nenum Legacy { Draft = "draft" }',
        filename: OWNER_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a comment wedged between the annotation and the declaration breaks the pair",
        code: '/** @canonical-values order.status */\n// these two are ordered for display\nexport const ORDER_STATUS = ["draft", "published"] as const;',
        filename: OWNER_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a line comment annotation is not a declaration the catalog derives values from",
        code: '// @canonical-values order.status\nexport const ORDER_STATUS = ["draft", "published"] as const;',
        filename: OWNER_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a single star block annotation is not a declaration the catalog derives values from",
        code: '/* @canonical-values order.status */\nexport const ORDER_STATUS = ["draft", "published"] as const;',
        filename: OWNER_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an annotation nested inside a statement exempts no later statement",
        code: 'export const make = () => {\n  /** @canonical-values order.status */\n  const local = 0;\n  return local;\n};\nexport const fallback = "published";',
        filename: OWNER_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "importing the owner does not exempt another raw literal in the same file",
        code: 'import { ORDER_STATUS } from "@mst/order";\nexport const first = ORDER_STATUS[0];\nexport const other = "published";',
        filename: SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
    ],
  });
});

describe("dont-review-it/no-strict-canonical-literal-use--use-canonical-import catalog access", () => {
  testLintRule(
    createNoStrictCanonicalLiteralUseRule({
      loadCatalog: () => {
        throw new Error("the catalog must not be built before a candidate literal appears");
      },
    }),
    {
      valid: [
        {
          name: "an out of scope source never reaches the catalog",
          code: 'const status = "draft";',
          filename: "/repo/packages/order/src/status.test.ts",
        },
        {
          name: "a source without any literal never reaches the catalog",
          code: "export const noop = () => {};",
          filename: SOURCE,
        },
        {
          name: "a literal ruled out by its position never reaches the catalog",
          code: 'import { load } from "draft";\nexport const loader = load;',
          filename: SOURCE,
        },
      ],
      invalid: [],
    },
  );

  testLintRule(
    createNoStrictCanonicalLiteralUseRule({
      loadCatalog: ({ repositoryRoot }) =>
        repositoryRoot === "/repo" ? CATALOG : EMPTY_CANONICAL_VALUES_CATALOG,
    }),
    {
      valid: [
        {
          name: "a working directory outside the repository resolves no vocabulary",
          code: 'const status = "published";',
          filename: SOURCE,
          cwd: "/elsewhere",
        },
      ],
      invalid: [
        {
          name: "the loader receives the workspace root found from the linter working directory",
          code: 'const status = "published";',
          filename: SOURCE,
          cwd: "/repo",
          errors: [{ messageId: "canonicalValueLiteral" }],
        },
      ],
    },
  );
});
