import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { STRICT_RULE, STRICT_SOURCE } from "./canonical-literal-rule-test-fixture.ts";

describe("canonical literal syntax positions", () => {
  testLintRule(STRICT_RULE, {
    valid: [
      {
        name: "a non computed object property key is owned by the object, not by the vocabulary",
        code: 'const counts = { "draft": 0 };',
        filename: STRICT_SOURCE,
      },
      {
        name: "a non computed type member key is owned by the type that declares it",
        code: 'type Counts = { "draft": number };',
        filename: STRICT_SOURCE,
      },
      {
        name: "a method signature name is owned by the type that declares it",
        code: 'interface Api { "draft"(): void }',
        filename: STRICT_SOURCE,
      },
      {
        name: "an enum member name is a key, not a use site",
        code: 'enum Legacy { "draft" = 0 }',
        filename: STRICT_SOURCE,
      },
      {
        name: "the key selector of Pick selects from a type that already owns the spelling",
        code: 'type Article = { draft: string; body: string };\ntype Head = Pick<Article, "draft">;',
        filename: STRICT_SOURCE,
      },
      {
        name: "the key selector of Omit selects from a type that already owns the spelling",
        code: 'type Article = { draft: string; body: string };\ntype Rest = Omit<Article, "draft">;',
        filename: STRICT_SOURCE,
      },
      {
        name: "a template literal in the key selector of Pick is judged by its position too",
        code: "type Article = { draft: string; body: string };\ntype Head = Pick<Article, `draft`>;",
        filename: STRICT_SOURCE,
      },
      {
        name: "a module specifier names a package, not a member of a vocabulary",
        code: 'import { load } from "draft";\nexport const loader = load;',
        filename: STRICT_SOURCE,
      },
      {
        name: "an import-equals module specifier is not a vocabulary use",
        code: 'import legacy = require("draft");\nexport const loader = legacy;',
        filename: STRICT_SOURCE,
      },
      {
        name: "an exported import-equals module specifier is not a vocabulary use",
        code: 'export import legacy = require("draft");',
        filename: STRICT_SOURCE,
      },
      {
        name: "an imported name spelled as a string is a name, not a use site",
        code: 'import { "draft" as load } from "./loader.ts";\nexport const loader = load;',
        filename: STRICT_SOURCE,
      },
      {
        name: "an exported name spelled as a string is a name, not a use site",
        code: 'const load = () => {};\nexport { load as "draft" };',
        filename: STRICT_SOURCE,
      },
      {
        name: "an ambient module name is a module specifier",
        code: 'declare module "draft" {}',
        filename: STRICT_SOURCE,
      },
      {
        name: "an import attribute is protocol syntax, not a use site",
        code: 'import table from "./table.json" with { type: "draft" };\nexport const loaded = table;',
        filename: STRICT_SOURCE,
      },
      {
        name: "a dynamic import with attribute is protocol syntax, not a use site",
        code: 'export const loaded = import("./table.json", { with: { type: "draft" } });',
        filename: STRICT_SOURCE,
      },
      {
        name: "a dynamic import assertion is protocol syntax, not a use site",
        code: 'export const loaded = import("./table.json", { assert: { type: "draft" } });',
        filename: STRICT_SOURCE,
      },
      {
        name: "a dynamic import source behind a type assertion is module syntax",
        code: 'export const loaded = import("draft" as string);',
        filename: STRICT_SOURCE,
      },
      {
        name: "a dynamic import source behind satisfies is module syntax",
        code: 'export const loaded = import("draft" satisfies string);',
        filename: STRICT_SOURCE,
      },
    ],
    invalid: [
      {
        name: "a computed object property key is a use site",
        code: 'const counts = { ["published"]: 0 };',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a record type writes a new key set rather than selecting from one",
        code: 'type Counts = Record<"published", number>;',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "the source type argument of Pick is still checked",
        code: 'type Head = Pick<Record<"published", number>, "published">;',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a local type named Pick cannot impersonate the standard key selector",
        code: 'type Pick<Source, Selector> = Selector;\ntype Escape = Pick<unknown, "draft" | "published">;',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an imported type named Omit cannot impersonate the standard key selector",
        code: 'import type { Omit } from "fake-utility";\ntype Escape = Omit<unknown, "published">;',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "Exclude narrows a union instead of selecting keys, so its literal is a use site",
        code: 'import type { OrderStatus } from "@mst/order";\nexport type Live = Exclude<OrderStatus, "published">;',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an unrelated dynamic import option cannot hide a vocabulary use",
        code: 'export const loaded = import("./table.json", { fallback: "published" });',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a call that computes dynamic import attributes cannot hide a vocabulary use",
        code: 'declare const attributesFor: (value: string) => object;\nexport const loaded = import("./table.json", { with: attributesFor("published") });',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a conditional that computes dynamic import assertions cannot hide a vocabulary use",
        code: 'declare const enabled: boolean;\ndeclare const attributes: object;\ndeclare const fallback: (value: string) => object;\nexport const loaded = import("./table.json", { assert: enabled ? attributes : fallback("published") });',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a call beneath a direct dynamic import attribute value remains a vocabulary use",
        code: 'declare const normalize: (value: string) => string;\nexport const loaded = import("./table.json", { with: { type: normalize("published") } });',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a conditional beneath a direct dynamic import attribute value remains a vocabulary use",
        code: 'declare const enabled: boolean;\nexport const loaded = import("./table.json", { with: { type: enabled ? "published" : "json" } });',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a literal nested in a nontransparent dynamic import source remains a use",
        code: 'export const loaded = import(selectSource("published"));',
        filename: STRICT_SOURCE,
        errors: [
          { messageId: "productionImportsOutOfScopeSource" },
          { messageId: "canonicalValueLiteral" },
        ],
      },
    ],
  });
});
