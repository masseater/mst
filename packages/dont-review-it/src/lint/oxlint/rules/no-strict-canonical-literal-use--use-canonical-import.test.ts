import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { buildCatalog } from "../lib/canonical-values/catalog.ts";
import { scanCanonicalValuesText } from "../lib/canonical-values/declarations.ts";
import { fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import { createNoStrictCanonicalLiteralUseRule } from "./no-strict-canonical-literal-use--use-canonical-import.ts";

const catalog = buildCatalog([
  {
    annotationStart: 0,
    binding: "ORDER_STATUSES",
    bindingStart: 60,
    conceptId: "order.status",
    declarationEnd: 110,
    declarationPath: "packages/vocabulary/src/status.ts",
    declarationStart: 38,
    fingerprint: fingerprintValues(["draft", "published", -1, null]),
    importRoutes: [
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
        specifier: "@fixture/vocabulary",
      },
    ],
    packageName: null,
    values: ["draft", "published", -1, null],
  },
]);

const rule = createNoStrictCanonicalLiteralUseRule({ loadCatalog: () => catalog });

const ownerSource = `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
export const duplicate = "draft";`;
const ownerDeclaration = scanCanonicalValuesText(
  ownerSource,
  "/repo/packages/vocabulary/src/status.ts",
).declarations[0];
if (ownerDeclaration === undefined) throw new Error("canonical owner fixture must parse");
const ownerCatalog = buildCatalog([
  {
    ...ownerDeclaration,
    declarationPath: "packages/vocabulary/src/status.ts",
    fingerprint: fingerprintValues(["draft", "published"]),
    importRoutes: [],
    packageName: null,
    values: ["draft", "published"],
  },
]);
const ownerRule = createNoStrictCanonicalLiteralUseRule({ loadCatalog: () => ownerCatalog });

describe("dont-review-it/no-strict-canonical-literal-use--use-canonical-import", () => {
  testLintRule(rule, {
    valid: [
      {
        name: "a value the catalog does not carry is spelled where it is used",
        code: 'const value = "unlisted";',
        documented: true,
      },
      { name: "a module specifier is not a site of use", code: 'import value from "draft";' },
      {
        name: "a property key is not a site of use",
        code: 'const object = { draft: "unlisted" };',
      },
      {
        name: "a regular expression is not a literal this rule reads",
        code: "const pattern = /draft/u;",
      },
      { name: "a bigint literal carries no catalog value", code: "const total = 1n;" },
      {
        name: "a template carrying a substitution is settled at run time",
        code: "const message = `draft${suffix}`;",
      },
      { name: "an operator on a binding names no value", code: "const enabled = !flag;" },
      {
        name: "selecting from an existing structure is not describing a new set",
        code: 'type Draft = Pick<Model, "draft">;',
        documented: true,
      },
      {
        name: "a file outside the production scope is not read",
        code: 'const value = "draft";',
        filename: "/repo/src/value.fixture.ts",
        cwd: "/repo",
      },
    ],
    invalid: [
      {
        name: "a catalog value spelled at the site of use is reported",
        code: 'const value = "draft";',
        errors: [{ messageId: "canonicalValueLiteral" }],
        documented: true,
      },
      {
        name: "a catalog value standing as a literal type is reported",
        code: 'type Status = "published";',
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a negative numeric literal in the catalog is reported",
        code: "const value = -1;",
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a null literal in the catalog is reported",
        code: "const value = null;",
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "a template carrying no substitution is the value it spells",
        code: "const value = `draft`;",
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        name: "keys that describe a new set are each reported",
        code: 'type StatusMap = Record<"draft" | "published", boolean>;',
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
        documented: true,
      },
    ],
  });

  testLintRule(ownerRule, {
    valid: [
      {
        name: "the values inside the owner declaration are where the concept is defined",
        code: `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;`,
        cwd: "/repo",
        filename: "/repo/packages/vocabulary/src/status.ts",
      },
    ],
    invalid: [
      {
        name: "a value outside the declaration in the owner's own file carries no exemption",
        code: ownerSource,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }],
        filename: "/repo/packages/vocabulary/src/status.ts",
      },
    ],
  });
});
