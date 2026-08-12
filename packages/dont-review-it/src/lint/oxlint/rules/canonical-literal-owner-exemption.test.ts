import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { buildCatalog } from "../lib/canonical-values/catalog.ts";
import { fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import {
  STRICT_CATALOG,
  STRICT_OWNER_CODE,
  STRICT_OWNER_SOURCE,
  STRICT_RULE,
  STRICT_SOURCE,
} from "./canonical-literal-rule-test-fixture.ts";
import { createNoStrictCanonicalLiteralUseRule } from "./no-strict-canonical-literal-use--use-canonical-import.ts";

const NESTED_OWNER_DECLARATION = `export const ORDER_TRANSITIONS: Record<"draft" | "published", unknown> = {
  draft: { fallback: "archived" },
  published: { label: "published", synchronized: true },
} as const;`;
const NESTED_OWNER_CODE = `/** @canonical-values order.transition */\n${NESTED_OWNER_DECLARATION}`;
const NESTED_OWNER_SOURCE = "/repo/packages/order/src/transition.ts";
const NESTED_OWNER_ENTRY = {
  annotationStart: 0,
  binding: "ORDER_TRANSITIONS",
  bindingStart: NESTED_OWNER_CODE.indexOf("ORDER_TRANSITIONS"),
  conceptId: "order.transition",
  declarationEnd: NESTED_OWNER_CODE.length,
  declarationPath: "packages/order/src/transition.ts",
  declarationStart: NESTED_OWNER_CODE.indexOf(NESTED_OWNER_DECLARATION),
  fingerprint: fingerprintValues(["draft", "published"]),
  importRoutes: [],
  packageName: "@mst/order",
  values: ["draft", "published"],
} as const;
const NESTED_OWNER_RULE = createNoStrictCanonicalLiteralUseRule({
  loadCatalog: () => buildCatalog([...STRICT_CATALOG.entries, NESTED_OWNER_ENTRY]),
});

const DISCARDED_OWNER_DECLARATION =
  'export const ORDER_PHASES = [(void "published", "draft"), "published"] as const;';
const DISCARDED_OWNER_CODE = `/** @canonical-values order.phase */\n${DISCARDED_OWNER_DECLARATION}`;
const DISCARDED_OWNER_SOURCE = "/repo/packages/order/src/phase.ts";
const DISCARDED_OWNER_ENTRY = {
  annotationStart: 0,
  binding: "ORDER_PHASES",
  bindingStart: DISCARDED_OWNER_CODE.indexOf("ORDER_PHASES"),
  conceptId: "order.phase",
  declarationEnd: DISCARDED_OWNER_CODE.length,
  declarationPath: "packages/order/src/phase.ts",
  declarationStart: DISCARDED_OWNER_CODE.indexOf(DISCARDED_OWNER_DECLARATION),
  fingerprint: fingerprintValues(["draft", "published"]),
  importRoutes: [],
  packageName: "@mst/order",
  values: ["draft", "published"],
} as const;
const DISCARDED_OWNER_RULE = createNoStrictCanonicalLiteralUseRule({
  loadCatalog: () => buildCatalog([...STRICT_CATALOG.entries, DISCARDED_OWNER_ENTRY]),
});

const ASSERTED_OWNER_DECLARATION =
  'export const ORDER_CHANNELS = [("draft" as "draft"), "published"] as const;';
const ASSERTED_OWNER_CODE = `/** @canonical-values order.channel */\n${ASSERTED_OWNER_DECLARATION}`;
const ASSERTED_OWNER_SOURCE = "/repo/packages/order/src/channel.ts";
const ASSERTED_OWNER_ENTRY = {
  annotationStart: 0,
  binding: "ORDER_CHANNELS",
  bindingStart: ASSERTED_OWNER_CODE.indexOf("ORDER_CHANNELS"),
  conceptId: "order.channel",
  declarationEnd: ASSERTED_OWNER_CODE.length,
  declarationPath: "packages/order/src/channel.ts",
  declarationStart: ASSERTED_OWNER_CODE.indexOf(ASSERTED_OWNER_DECLARATION),
  fingerprint: fingerprintValues(["draft", "published"]),
  importRoutes: [],
  packageName: "@mst/order",
  values: ["draft", "published"],
} as const;
const ASSERTED_OWNER_RULE = createNoStrictCanonicalLiteralUseRule({
  loadCatalog: () => buildCatalog([...STRICT_CATALOG.entries, ASSERTED_OWNER_ENTRY]),
});

const RESULT_OWNER_DECLARATION = `export const ORDER_RESULTS = [
  ...(["draft"] as const),
  (unused, "published"),
  enabled ? "archived" : "auto",
] as const;`;
const RESULT_OWNER_CODE = `/** @canonical-values order.result */\n${RESULT_OWNER_DECLARATION}`;
const RESULT_OWNER_SOURCE = "/repo/packages/order/src/result.ts";
const RESULT_OWNER_ENTRY = {
  annotationStart: 0,
  binding: "ORDER_RESULTS",
  bindingStart: RESULT_OWNER_CODE.indexOf("ORDER_RESULTS"),
  conceptId: "order.result",
  declarationEnd: RESULT_OWNER_CODE.length,
  declarationPath: "packages/order/src/result.ts",
  declarationStart: RESULT_OWNER_CODE.indexOf(RESULT_OWNER_DECLARATION),
  fingerprint: fingerprintValues(["draft", "published", "archived", "auto"]),
  importRoutes: [],
  packageName: "@mst/order",
  values: ["draft", "published", "archived", "auto"],
} as const;
const RESULT_OWNER_RULE = createNoStrictCanonicalLiteralUseRule({
  loadCatalog: () => buildCatalog([...STRICT_CATALOG.entries, RESULT_OWNER_ENTRY]),
});

const COMPUTED_OWNER_DECLARATION = `export const ORDER_BUCKETS = {
  ...{ ["draft"]: 0 },
  ["published"]: 1,
} as const;`;
const COMPUTED_OWNER_CODE = `/** @canonical-values order.bucket */\n${COMPUTED_OWNER_DECLARATION}`;
const COMPUTED_OWNER_SOURCE = "/repo/packages/order/src/bucket.ts";
const COMPUTED_OWNER_ENTRY = {
  annotationStart: 0,
  binding: "ORDER_BUCKETS",
  bindingStart: COMPUTED_OWNER_CODE.indexOf("ORDER_BUCKETS"),
  conceptId: "order.bucket",
  declarationEnd: COMPUTED_OWNER_CODE.length,
  declarationPath: "packages/order/src/bucket.ts",
  declarationStart: COMPUTED_OWNER_CODE.indexOf(COMPUTED_OWNER_DECLARATION),
  fingerprint: fingerprintValues(["draft", "published"]),
  importRoutes: [],
  packageName: "@mst/order",
  values: ["draft", "published"],
} as const;
const COMPUTED_OWNER_RULE = createNoStrictCanonicalLiteralUseRule({
  loadCatalog: () => buildCatalog([...STRICT_CATALOG.entries, COMPUTED_OWNER_ENTRY]),
});

describe("canonical literal owner exemptions", () => {
  testLintRule(STRICT_RULE, {
    valid: [
      {
        name: "the annotated value declaration the catalog registered is where the concept lives",
        code: STRICT_OWNER_CODE,
        filename: STRICT_OWNER_SOURCE,
        cwd: "/repo",
      },
    ],
    invalid: [
      {
        name: "the file that declares one concept is still checked for another",
        code: `${STRICT_OWNER_CODE}\nexport const fallback = "archived";`,
        filename: STRICT_OWNER_SOURCE,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an annotated type alias is not a registered variable owner",
        code: '/** @canonical-values order.status */\nexport type OrderStatus = "draft" | "published";',
        filename: STRICT_OWNER_SOURCE,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a different binding at the registered range is not exempt",
        code: '/** @canonical-values order.status */\nexport const OTHER_STATUS = ["draft", "published"] as const;',
        filename: STRICT_OWNER_SOURCE,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an annotation naming a concept the catalog registered elsewhere exempts nothing",
        code: '/** @canonical-values order.status */\nexport const ORDER_STATUS = ["draft", "published"] as const;',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an annotation naming a concept the catalog does not know exempts nothing",
        code: '/** @canonical-values totally.unrelated */\nexport const fallback = "published";',
        filename: STRICT_OWNER_SOURCE,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an annotated enum is exempt only when the catalog attributes the concept here",
        code: '/** @canonical-values totally.unrelated */\nenum Legacy { Draft = "draft" }',
        filename: STRICT_OWNER_SOURCE,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a comment wedged between the annotation and the declaration breaks the pair",
        code: '/** @canonical-values order.status */\n// these two are ordered for display\nexport const ORDER_STATUS = ["draft", "published"] as const;',
        filename: STRICT_OWNER_SOURCE,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a line comment annotation is not a declaration the catalog derives values from",
        code: '// @canonical-values order.status\nexport const ORDER_STATUS = ["draft", "published"] as const;',
        filename: STRICT_OWNER_SOURCE,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a single star block annotation is not a declaration the catalog derives values from",
        code: '/* @canonical-values order.status */\nexport const ORDER_STATUS = ["draft", "published"] as const;',
        filename: STRICT_OWNER_SOURCE,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
      {
        name: "an annotation nested inside a statement exempts no later statement",
        code: 'export const make = () => {\n  /** @canonical-values order.status */\n  const local = 0;\n  return local;\n};\nexport const fallback = "published";',
        filename: STRICT_OWNER_SOURCE,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "importing the owner does not exempt another raw literal in the same file",
        code: 'import { ORDER_STATUS } from "@mst/order";\nexport const first = ORDER_STATUS[0];\nexport const other = "published";',
        filename: STRICT_SOURCE,
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
    ],
  });

  testLintRule(NESTED_OWNER_RULE, {
    valid: [],
    invalid: [
      {
        name: "an owner exempts neither a repeated type domain nor nested foreign vocabulary",
        code: NESTED_OWNER_CODE,
        filename: NESTED_OWNER_SOURCE,
        cwd: "/repo",
        errors: [
          { line: 2, messageId: "canonicalValueLiteral" },
          { line: 2, messageId: "canonicalValueLiteral" },
          { line: 3, messageId: "canonicalValueLiteral" },
          {
            column: 22,
            endColumn: 33,
            line: 4,
            messageId: "canonicalValueLiteral",
          },
          {
            column: 49,
            endColumn: 53,
            line: 4,
            messageId: "canonicalValueLiteral",
          },
        ],
      },
    ],
  });

  testLintRule(DISCARDED_OWNER_RULE, {
    valid: [],
    invalid: [
      {
        name: "a discarded sequence value does not become part of an array owner",
        code: DISCARDED_OWNER_CODE,
        filename: DISCARDED_OWNER_SOURCE,
        cwd: "/repo",
        errors: [
          {
            column: 35,
            endColumn: 46,
            line: 2,
            messageId: "canonicalValueLiteral",
          },
        ],
      },
    ],
  });

  testLintRule(ASSERTED_OWNER_RULE, {
    valid: [],
    invalid: [
      {
        name: "a literal type inside an assertion does not become part of an array owner",
        code: ASSERTED_OWNER_CODE,
        filename: ASSERTED_OWNER_SOURCE,
        cwd: "/repo",
        errors: [
          {
            column: 43,
            endColumn: 50,
            line: 2,
            messageId: "canonicalValueLiteral",
          },
        ],
      },
    ],
  });

  testLintRule(RESULT_OWNER_RULE, {
    valid: [
      {
        name: "array owner values may come from static spreads and result expressions",
        code: RESULT_OWNER_CODE,
        filename: RESULT_OWNER_SOURCE,
        cwd: "/repo",
      },
    ],
    invalid: [],
  });

  testLintRule(COMPUTED_OWNER_RULE, {
    valid: [
      {
        name: "object owner values may come from computed keys in static spreads",
        code: COMPUTED_OWNER_CODE,
        filename: COMPUTED_OWNER_SOURCE,
        cwd: "/repo",
      },
    ],
    invalid: [],
  });
});
