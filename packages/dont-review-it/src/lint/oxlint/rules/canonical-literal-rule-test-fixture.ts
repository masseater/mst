import { buildCatalog } from "../lib/canonical-values/catalog.ts";
import { fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import { ownershipPolicyOf } from "../lib/canonical-values/ownership-policy.ts";
import { createNoStrictCanonicalLiteralUseRule } from "./no-strict-canonical-literal-use--use-canonical-import.ts";

const STRICT_OWNER_DECLARATION = 'export const ORDER_STATUS = ["draft", "published"] as const;';
const STRICT_OWNER_CODE = `/** @canonical-values order.status */\n${STRICT_OWNER_DECLARATION}`;
const declarationStart = STRICT_OWNER_CODE.indexOf(STRICT_OWNER_DECLARATION);
const declarationEnd = declarationStart + STRICT_OWNER_DECLARATION.length;

const STRICT_CATALOG = buildCatalog([
  {
    annotationStart: 0,
    binding: "ORDER_STATUS",
    bindingStart: STRICT_OWNER_CODE.indexOf("ORDER_STATUS"),
    conceptId: "order.status",
    declarationEnd,
    declarationPath: "packages/order/src/status.ts",
    declarationStart,
    fingerprint: fingerprintValues(["draft", "published"]),
    importRoutes: [
      {
        exportName: "ORDER_STATUS",
        resolvedSourcePaths: ["packages/order/src/index.ts"],
        specifier: "@mst/order",
      },
    ],
    packageName: "@mst/order",
    values: ["draft", "published"],
  },
  {
    annotationStart: 0,
    binding: "ARTICLE_STATUSES",
    bindingStart: 1,
    conceptId: "article.status",
    declarationEnd: 2,
    declarationPath: "packages/article/src/status.ts",
    declarationStart: 1,
    fingerprint: fingerprintValues(["draft", "archived"]),
    importRoutes: [],
    packageName: "@mst/article",
    values: ["draft", "archived"],
  },
  {
    annotationStart: 0,
    binding: "RETRY_BUDGETS",
    bindingStart: 1,
    conceptId: "retry.budget",
    declarationEnd: 2,
    declarationPath: "packages/retry/src/budget.ts",
    declarationStart: 1,
    fingerprint: fingerprintValues([3, -1]),
    importRoutes: [
      {
        exportName: "RETRY_BUDGETS",
        resolvedSourcePaths: ["packages/retry/src/index.ts"],
        specifier: "@mst/retry",
      },
    ],
    packageName: "@mst/retry",
    values: [3, -1],
  },
  {
    annotationStart: 0,
    binding: "SYNC_MODES",
    bindingStart: 1,
    conceptId: "sync.mode",
    declarationEnd: 2,
    declarationPath: "packages/sync/src/mode.ts",
    declarationStart: 1,
    fingerprint: fingerprintValues(["auto", true, null]),
    importRoutes: [
      {
        exportName: "SYNC_MODES",
        resolvedSourcePaths: ["packages/sync/src/index.ts"],
        specifier: "@mst/sync",
      },
    ],
    packageName: "@mst/sync",
    values: ["auto", true, null],
  },
  {
    annotationStart: 0,
    binding: "PROPERTY_KEYS",
    bindingStart: 1,
    conceptId: "property.keys",
    declarationEnd: 2,
    declarationPath: "packages/property/src/keys.ts",
    declarationStart: 1,
    fingerprint: fingerprintValues(["-1", "1", "1e+0", "true", "null"]),
    importRoutes: [],
    packageName: "@mst/property",
    values: ["-1", "1", "1e+0", "true", "null"],
  },
]);

const STRICT_RULE = createNoStrictCanonicalLiteralUseRule({
  loadCatalog: () => STRICT_CATALOG,
});
const STRICT_SOURCE = "/repo/packages/order/src/order.ts";
const STRICT_OWNER_SOURCE = "/repo/packages/order/src/status.ts";
const UNCONFIGURED_OWNERSHIP_POLICY = ownershipPolicyOf([]);

export {
  STRICT_CATALOG,
  STRICT_OWNER_CODE,
  STRICT_OWNER_SOURCE,
  STRICT_RULE,
  STRICT_SOURCE,
  UNCONFIGURED_OWNERSHIP_POLICY,
};
