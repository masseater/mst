import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { buildCatalog } from "../lib/canonical-values/catalog.ts";
import { scanCanonicalValuesText } from "../lib/canonical-values/declarations.ts";
import { fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { EMPTY_LIBRARY_VOCABULARY_INDEX } from "../lib/library-vocabulary/vocabulary-index.ts";
import { createNoLocalFiniteValueSet } from "./no-local-finite-value-set--use-or-register-canonical-values.ts";

const OWNER_SOURCE = join(findWorkspaceRoot(process.cwd()), "packages/order/src/status.ts");

const ownerRule = (source: string) => {
  const declaration = scanCanonicalValuesText(source, OWNER_SOURCE).declarations[0];
  if (declaration === undefined) throw new Error("the owner declaration must be scannable");
  return createNoLocalFiniteValueSet({
    loadCatalog: () =>
      buildCatalog([
        {
          annotationStart: declaration.annotationStart,
          binding: declaration.binding,
          bindingStart: declaration.bindingStart,
          conceptId: declaration.conceptId,
          declarationEnd: declaration.declarationEnd,
          declarationPath: "packages/order/src/status.ts",
          declarationStart: declaration.declarationStart,
          fingerprint: fingerprintValues(["draft", "published"]),
          importRoutes: [],
          packageName: "@mst/order",
          values: ["draft", "published"],
        },
      ]),
    loadLibraryVocabulary: () => EMPTY_LIBRARY_VOCABULARY_INDEX,
  });
};

describe("canonical value report owner results", () => {
  const conditional = `/** @canonical-values order.status */
export const ORDER_STATUSES = enabled
  ? (["draft", "published"] as const)
  : (["draft", "published"] as const);
export type OrderStatus = (typeof ORDER_STATUSES)[number];`;
  testLintRule(ownerRule(conditional), {
    valid: [{ code: conditional, filename: OWNER_SOURCE }],
    invalid: [],
  });

  const sequence = `/** @canonical-values order.status */
export const ORDER_STATUSES = (sideEffect(), ["draft", "published"] as const);
export type OrderStatus = (typeof ORDER_STATUSES)[number];`;
  testLintRule(ownerRule(sequence), {
    valid: [{ code: sequence, filename: OWNER_SOURCE }],
    invalid: [],
  });
});
