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
      { code: 'const value = "unlisted";' },
      { code: 'import value from "draft";' },
      { code: 'const object = { draft: "unlisted" };' },
      { code: "const pattern = /draft/u;" },
      { code: "const total = 1n;" },
      { code: "const message = `draft${suffix}`;" },
      { code: "const enabled = !flag;" },
      { code: 'type Draft = Pick<Model, "draft">;' },
      {
        code: 'const value = "draft";',
        filename: "/repo/src/value.fixture.ts",
        cwd: "/repo",
      },
    ],
    invalid: [
      {
        code: 'const value = "draft";',
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        code: 'type Status = "published";',
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        code: "const value = -1;",
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        code: "const value = null;",
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        code: "const value = `draft`;",
        errors: [{ messageId: "canonicalValueLiteral" }],
      },
      {
        code: 'type StatusMap = Record<"draft" | "published", boolean>;',
        errors: [{ messageId: "canonicalValueLiteral" }, { messageId: "canonicalValueLiteral" }],
      },
    ],
  });

  testLintRule(ownerRule, {
    valid: [
      {
        code: `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;`,
        cwd: "/repo",
        filename: "/repo/packages/vocabulary/src/status.ts",
      },
    ],
    invalid: [
      {
        code: ownerSource,
        cwd: "/repo",
        errors: [{ messageId: "canonicalValueLiteral" }],
        filename: "/repo/packages/vocabulary/src/status.ts",
      },
    ],
  });
});
