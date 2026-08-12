import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import {
  ORDER_BLANK_OWNER_CODE,
  ORDER_OBJECT_OWNER_CODE,
  ORDER_OWNER_CODE,
  withAmbiguousOwners,
  withBlankOwner,
  withCatalogAndLibraryOwners,
  withLibraryOwner,
  withNullableOwner,
  withNumericOwner,
  withObjectOwner,
  withOwner,
  withTwoLibraryOwners,
  withoutCatalog,
  withoutEntriesInRepositoryPackage,
} from "./canonical-value-rule-test-fixture.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: owner and report contracts", () => {
  testLintRule(withNullableOwner, {
    valid: [],
    invalid: [
      {
        name: "null remains a value in a literal union",
        code: 'export type MaybeStatus = "draft" | null;',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "null remains a value in a static array",
        code: 'export const schema = z.enum(["draft", null]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "null remains a value in a schema literal union",
        code: 'export const schema = z.union([z.literal("draft"), z.literal(null)]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });

  testLintRule(withNumericOwner, {
    valid: [],
    invalid: [
      {
        name: "negative numbers keep their sign in a literal union",
        code: "export type RetryBudget = -1 | 1;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "nested unary signs keep their numeric value in a schema array",
        code: "export const schema = z.enum([-+1, +1]);",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "static arithmetic keeps its numeric vocabulary",
        code: "export const schema = z.enum([2 - 3, 3 - 2]);",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "static numeric calls keep their numeric vocabulary",
        code: 'export const schema = z.enum([Number("-1"), Math.ceil(0.1)]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });

  testLintRule(withBlankOwner, {
    valid: [
      {
        name: "blank lines between the annotation and its declaration keep them paired",
        code: ORDER_BLANK_OWNER_CODE,
        filename: "/repo/packages/order-vocabulary/src/order-status.ts",
        cwd: "/repo",
      },
    ],
    invalid: [],
  });

  testLintRule(withObjectOwner, {
    valid: [],
    invalid: [
      {
        name: "an annotated object owner does not exempt a nested schema enum with another fingerprint",
        code: ORDER_OBJECT_OWNER_CODE,
        filename: "/repo/packages/order-vocabulary/src/order-status.ts",
        cwd: "/repo",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
    ],
  });

  testLintRule(withOwner, {
    valid: [
      {
        name: "an array that only fixes display order defines no type",
        code: 'const DISPLAY_ORDER = ["draft", "published"];\nexport const first = DISPLAY_ORDER[0];',
      },
      {
        name: "a set assembled at run time is not a static vocabulary",
        code: "export const seen = (rows) => new Set(rows.map((row) => row.status));",
      },
      {
        name: "a union widened by a keyword is not finite",
        code: 'export type Loose = string | "draft";',
      },
      {
        name: "a discriminated union carries structure rather than values",
        code: 'export type Event = { kind: "draft" } | { kind: "published" };',
      },
      {
        name: "a union written in a parameter position is outside the grammar",
        code: 'export const label = (status: "draft" | "published") => status;',
      },
      {
        name: "a union written in a return position is outside the grammar",
        code: 'export const initial = (): "draft" | "published" => "draft";',
      },
      {
        name: "the annotated declaration is the place the concept is defined",
        code: ORDER_OWNER_CODE,
        filename: "/repo/packages/order-vocabulary/src/order-status.ts",
        cwd: "/repo",
      },
      {
        name: "a set whose values no concept owns is not a candidate",
        code: 'const CACHE_KEYS = new Set(["alpha", "beta"]);\nexport const has = (key) => CACHE_KEYS.has(key);',
      },
      {
        name: "a test file is not production source",
        code: 'export type OrderStatus = "draft" | "published";',
        filename: "/repo/packages/order/src/order-status.test.ts",
      },
    ],
    invalid: [
      {
        name: "a conditional local object receiver cannot hide its member vocabulary",
        code: 'const holder = { statuses: ["draft", "published"] as const };\nexport const schema = z.enum((enabled ? holder : holder).statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a sequence local object receiver cannot hide its member vocabulary",
        code: 'const holder = { statuses: ["draft", "published"] as const };\nexport const schema = z.enum((0, holder).statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a spread supplying argument index zero keeps its local array value",
        code: 'const args = [...[["draft", "published"] as const]] as const;\nexport const schema = z.enum(...args);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "one array feeding two constructs is reported once",
        code: 'const STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof STATUSES)[number];\nexport const schema = z.enum(STATUSES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a line comment carrying the tag does not annotate the declaration below it",
        code: '// @canonical-values order-status\nexport const ORDER_STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof ORDER_STATUSES)[number];',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a block comment that is not a doc comment does not annotate either",
        code: '/* @canonical-values order-status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof ORDER_STATUSES)[number];',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an annotation buried in a function body annotates nothing at the top level",
        code: 'export const probeNoop = () => {\n  /** @canonical-values order-status */\n  return 1;\n};\n\nexport type OrderStatus = "draft" | "published";',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a comment wedged between the annotation and the declaration breaks the pair",
        code: '/** @canonical-values order-status */\n// sorted by the order the api returns\nexport const ORDER_STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof ORDER_STATUSES)[number];',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "the registered declaration range exempts no other path",
        code: ORDER_OWNER_CODE,
        filename: "/repo/packages/shadow/src/order-status.ts",
        cwd: "/repo",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "the report names the owner it found",
        code: 'export type OrderStatus = "draft" | "published";',
        errors: [{ message: /order-status \(@mst\/order-vocabulary\)/u }],
      },
      {
        name: "the configured ownership policy reaches the report",
        code: 'export type OrderStatus = "draft" | "published";',
        options: [
          { ownershipPolicy: "service wide operational vocabulary lives in @mst/vocabulary" },
        ],
        errors: [
          {
            message:
              /Ownership policy: service wide operational vocabulary lives in @mst\/vocabulary\./u,
          },
        ],
      },
    ],
  });

  testLintRule(withoutCatalog, {
    valid: [
      {
        name: "a set stays silent because it is only a candidate when a concept owns it",
        code: 'const STATUSES = new Set(["draft", "published"]);\nexport const has = (status) => STATUSES.has(status);',
      },
      {
        name: "an indexed access array stays silent for the same reason",
        code: 'const STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof STATUSES)[number];',
      },
      {
        name: "a set filled from an external import stays silent for the same reason",
        code: 'import { HTTP_METHOD_HINTS } from "http-method-hints";\nconst known = new Set(HTTP_METHOD_HINTS);\nexport const has = (hint) => known.has(hint);',
        filename: "packages/order/src/known.ts",
      },
      {
        name: "an indexed access over an external import stays silent for the same reason",
        code: 'import { HTTP_METHOD_HINTS } from "http-method-hints";\nexport type Hint = (typeof HTTP_METHOD_HINTS)[number];',
        filename: "packages/order/src/hint.ts",
      },
    ],
    invalid: [
      {
        name: "a vocabulary with no owner still has to be registered somewhere",
        code: 'export type OrderStatus = "draft" | "published";',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "the message that owns nothing offers the dependencies as a third place to look",
        code: 'export type OrderStatus = "draft" | "published";',
        errors: [{ message: /public types of the packages this one depends on/u }],
      },
      {
        name: "an unconfigured ownership policy says so instead of inventing one",
        code: 'export const schema = z.enum(["draft", "published"]);',
        errors: [
          {
            message:
              /Ownership policy: not configured \(set the ownershipPolicy option of this rule\)\./u,
          },
        ],
      },
      {
        name: "a relative route is unregistered while nothing is registered",
        code: 'import { STATUSES } from "./statuses.ts";\nexport const schema = z.enum(STATUSES);',
        filename: "packages/order/src/schema.ts",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a relative Set route is unregistered while nothing is registered",
        code: 'import { STATUSES } from "./statuses.ts";\nexport const statuses = new Set(STATUSES);',
        filename: "packages/order/src/schema.ts",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a relative indexed access route is unregistered while nothing is registered",
        code: 'import { STATUSES } from "./statuses.ts";\nexport type Status = (typeof STATUSES)[number];',
        filename: "packages/order/src/schema.ts",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
    ],
  });

  testLintRule(withoutEntriesInRepositoryPackage, {
    valid: [],
    invalid: [
      {
        name: "the package root remains an unregistered repository route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nexport const schema = z.enum(ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a package namespace remains an unregistered repository route",
        code: 'import * as vocabulary from "@mst/order-vocabulary";\nexport const schema = z.enum(vocabulary.ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
    ],
  });

  testLintRule(withLibraryOwner, {
    valid: [
      {
        name: "a set stays silent because a set was never reported without a catalog owner",
        code: 'const SEVERITIES = new Set(["error", "warn", "off"]);\nexport const has = (severity) => SEVERITIES.has(severity);',
      },
      {
        name: "an indexed access array stays silent for the same reason",
        code: 'const SEVERITIES = ["error", "warn", "off"] as const;\nexport type Severity = (typeof SEVERITIES)[number];',
      },
    ],
    invalid: [
      {
        name: "the report names the dependency and the type that own the values",
        code: 'export type Severity = "error" | "warn" | "off";',
        errors: [{ messageId: "localFiniteValueSetOwnedByLibraryType" }],
      },
      {
        name: "the report carries the name of the type the reader has to derive from",
        code: 'export type SsrTarget = "node" | "webworker";',
        errors: [{ message: /derive the type from SSRTarget from vite, so/u }],
      },
      {
        name: "a schema enum reaches the same dependency as the type alias does",
        code: 'export const schema = z.enum(["error", "warn", "off"]);',
        errors: [{ message: /AllowWarnDeny from oxlint/u }],
      },
      {
        name: "a vocabulary no dependency owns falls back to the message that owns nothing",
        code: 'export type OrderStatus = "draft" | "published";',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
    ],
  });

  testLintRule(withCatalogAndLibraryOwners, {
    valid: [],
    invalid: [
      {
        name: "the owner registered in this repository is the one the report names",
        code: 'export type SsrTarget = "node" | "webworker";',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });

  testLintRule(withTwoLibraryOwners, {
    valid: [],
    invalid: [
      {
        name: "every dependency is listed instead of one being picked",
        code: 'export type Severity = "error" | "warn";',
        errors: [{ message: /: AllowWarnDeny from oxlint \(.*\), LogLevel from vite \(/u }],
      },
    ],
  });

  testLintRule(withAmbiguousOwners, {
    valid: [
      {
        name: "an array that only fixes display order defines no type",
        code: 'const DISPLAY_ORDER = ["draft", "published"];\nexport const first = DISPLAY_ORDER[0];',
      },
    ],
    invalid: [
      {
        name: "every candidate is listed instead of one being picked",
        code: 'export type OrderStatus = "draft" | "published";',
        errors: [
          {
            messageId: "localFiniteValueSetWithOwnerCandidates",
            data: {
              owners:
                "order-status (@mst/order-vocabulary), article-status (@mst/article-vocabulary)",
              ownershipPolicy: "not configured (set the ownershipPolicy option of this rule)",
            },
          },
        ],
      },
    ],
  });
});
