import { testLintRule, type WorkspaceLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import {
  buildCatalog,
  EMPTY_CANONICAL_VALUES_CATALOG,
  type CanonicalValuesCatalog,
  type CanonicalValuesEntry,
} from "../lib/canonical-values/catalog.ts";
import { fingerprintValues, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import {
  buildLibraryVocabularyIndex,
  EMPTY_LIBRARY_VOCABULARY_INDEX,
  type LibraryVocabularyEntry,
  type LibraryVocabularyIndex,
} from "../lib/library-vocabulary/vocabulary-index.ts";
import { createNoLocalFiniteValueSet } from "./no-local-finite-value-set--use-or-register-canonical-values.ts";

const ORDER_STATUS_VALUES: readonly CanonicalValue[] = ["draft", "published"];

type WorkspaceVocabulary = {
  readonly workspace: string;
  readonly vocabulary: readonly CanonicalValue[];
};

const entry = (
  conceptId: string,
  { workspace, vocabulary }: WorkspaceVocabulary,
): CanonicalValuesEntry => ({
  conceptId,
  declarationPath: `packages/${workspace}/src/${conceptId}.ts`,
  exportPath: `@mst/${workspace}`,
  values: vocabulary,
  fingerprint: fingerprintValues(vocabulary),
});

const ownedCatalog = buildCatalog([
  entry("order-status", { workspace: "order-vocabulary", vocabulary: ORDER_STATUS_VALUES }),
]);

const ambiguousCatalog = buildCatalog([
  entry("order-status", { workspace: "order-vocabulary", vocabulary: ORDER_STATUS_VALUES }),
  entry("article-status", { workspace: "article-vocabulary", vocabulary: ORDER_STATUS_VALUES }),
]);

type AdmittedVocabulary = {
  readonly typeName: string;
  readonly admits: readonly CanonicalValue[];
  readonly admitsUnnamedValues?: boolean;
};

const libraryType = (
  packageName: string,
  { typeName, admits, admitsUnnamedValues = false }: AdmittedVocabulary,
): LibraryVocabularyEntry => ({
  packageName,
  typeName,
  declarationId: `${packageName}#${typeName}`,
  values: admits,
  admitsUnnamedValues,
});

const ruleReading = (
  catalog: CanonicalValuesCatalog,
  libraries: LibraryVocabularyIndex = EMPTY_LIBRARY_VOCABULARY_INDEX,
): WorkspaceLintRule =>
  createNoLocalFiniteValueSet({
    loadCatalog: () => catalog,
    loadLibraryVocabulary: () => libraries,
  });

const severityAndTarget = buildLibraryVocabularyIndex([
  libraryType("oxlint", {
    typeName: "AllowWarnDeny",
    admits: ["allow", "deny", "error", "off", "warn"],
    admitsUnnamedValues: true,
  }),
  libraryType("vite", { typeName: "SSRTarget", admits: ["node", "webworker"] }),
]);

const withOwner = ruleReading(ownedCatalog);
const withoutCatalog = ruleReading(EMPTY_CANONICAL_VALUES_CATALOG);
const withAmbiguousOwners = ruleReading(ambiguousCatalog);
const withLibraryOwner = ruleReading(EMPTY_CANONICAL_VALUES_CATALOG, severityAndTarget);
const withCatalogAndLibraryOwners = ruleReading(
  buildCatalog([
    entry("ssr-target", { workspace: "ssr-vocabulary", vocabulary: ["node", "webworker"] }),
  ]),
  severityAndTarget,
);
const withTwoLibraryOwners = ruleReading(
  EMPTY_CANONICAL_VALUES_CATALOG,
  buildLibraryVocabularyIndex([
    libraryType("oxlint", { typeName: "AllowWarnDeny", admits: ["error", "off", "warn"] }),
    libraryType("vite", { typeName: "LogLevel", admits: ["error", "info", "off", "warn"] }),
  ]),
);

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values", () => {
  describe("against a catalog that owns the value set", () => {
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
          name: "an enum fed from an external package is not a repository vocabulary",
          code: 'import { STATUSES } from "order-statuses";\nexport const schema = z.enum(STATUSES);',
        },
        {
          name: "an alias keeps one value once null is set aside",
          code: 'export type MaybeStatus = "draft" | null;',
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
          name: "two hops away from the array is outside the one hop grammar",
          code: 'const RAW = ["draft", "published"];\nconst STATUSES = RAW;\nexport const schema = z.enum(STATUSES);',
        },
        {
          name: "an indexed access over a registered export path stays derived",
          code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nexport type OrderStatus = (typeof ORDER_STATUSES)[number];',
        },
        {
          name: "a relative import that resolves to the annotated declaration stays derived",
          code: 'import { ORDER_STATUSES } from "./order-status.ts";\nexport const schema = z.enum(ORDER_STATUSES);',
          filename: "packages/order-vocabulary/src/schema.ts",
        },
        {
          name: "the annotated declaration is the place the concept is defined",
          code: '/** @canonical-values order-status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof ORDER_STATUSES)[number];',
        },
        {
          name: "blank lines between the annotation and its declaration keep them paired",
          code: '/** @canonical-values order-status */\n\nexport const ORDER_STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof ORDER_STATUSES)[number];',
        },
        {
          name: "a set whose values no concept owns is not a candidate",
          code: 'const CACHE_KEYS = new Set(["alpha", "beta"]);\nexport const has = (key) => CACHE_KEYS.has(key);',
        },
        {
          name: "an indexed access array whose values no concept owns is not a candidate",
          code: 'const SIZES = ["small", "large"] as const;\nexport type Size = (typeof SIZES)[number];',
        },
        {
          name: "a set filled from a repository import declares no vocabulary here",
          code: 'import { HTTP_METHOD_HINTS } from "./probe-plain.ts";\nconst known = new Set(HTTP_METHOD_HINTS);\nexport const has = (hint) => known.has(hint);',
          filename: "packages/order/src/known.ts",
        },
        {
          name: "an indexed access over a repository import declares no vocabulary here",
          code: 'import { HTTP_METHOD_HINTS } from "./probe-plain.ts";\nexport type Hint = (typeof HTTP_METHOD_HINTS)[number];',
          filename: "packages/order/src/hint.ts",
        },
        {
          name: "a test file is not production source",
          code: 'export type OrderStatus = "draft" | "published";',
          filename: "packages/order/src/order-status.test.ts",
        },
      ],
      invalid: [
        {
          name: "a static array handed straight to a schema enum defines the vocabulary here",
          code: 'export const schema = z.enum(["draft", "published"]);',
          errors: [{ messageId: "localFiniteValueSetWithOwner" }],
        },
        {
          name: "one hop through a local const does not move the definition",
          code: 'const STATUSES = ["draft", "published"] as const;\nexport const schema = z.enum(STATUSES);',
          errors: [{ messageId: "localFiniteValueSetWithOwner" }],
        },
        {
          name: "a scalar literal type alias declares a vocabulary",
          code: 'export type OrderStatus = "draft" | "published";',
          errors: [{ messageId: "localFiniteValueSetWithOwner" }],
        },
        {
          name: "template literals spell the same vocabulary as quoted literals",
          code: "export type OrderStatus = `draft` | `published`;",
          errors: [{ messageId: "localFiniteValueSetWithOwner" }],
        },
        {
          name: "a schema union of literals is the same vocabulary in another syntax",
          code: 'export const schema = z.union([z.literal("draft"), z.literal("published")]);',
          errors: [{ messageId: "localFiniteValueSetWithOwner" }],
        },
        {
          name: "an options schema of a lint rule declares an enum",
          code: 'export const schema = [{ type: "object", properties: { status: { enum: ["draft", "published"] } } }];',
          errors: [{ messageId: "localFiniteValueSetWithOwner" }],
        },
        {
          name: "a static array behind an indexed access matches a registered value set",
          code: 'const STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof STATUSES)[number];',
          errors: [{ messageId: "localFiniteValueSetWithOwner" }],
        },
        {
          name: "a static set initializer matches a registered value set",
          code: 'const STATUSES = new Set(["draft", "published"]);\nexport const has = (status) => STATUSES.has(status);',
          errors: [{ messageId: "localFiniteValueSetWithOwner" }],
        },
        {
          name: "one array feeding two constructs is reported once",
          code: 'const STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof STATUSES)[number];\nexport const schema = z.enum(STATUSES);',
          errors: [{ messageId: "localFiniteValueSetWithOwner" }],
        },
        {
          name: "a relative import the catalog does not resolve is an unregistered route",
          code: 'import { STATUSES } from "./statuses.ts";\nexport const schema = z.enum(STATUSES);',
          filename: "packages/order/src/schema.ts",
          errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
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
        {
          name: "the report names the owner it found",
          code: 'export type OrderStatus = "draft" | "published";',
          errors: [{ message: /order-status \(@mst\/order-vocabulary\)/u }],
        },
      ],
    });
  });

  describe("against a catalog that resolves nothing", () => {
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
          name: "a set filled from a repository import stays silent for the same reason",
          code: 'import { HTTP_METHOD_HINTS } from "./probe-plain.ts";\nconst known = new Set(HTTP_METHOD_HINTS);\nexport const has = (hint) => known.has(hint);',
          filename: "packages/order/src/known.ts",
        },
        {
          name: "an indexed access over a repository import stays silent for the same reason",
          code: 'import { HTTP_METHOD_HINTS } from "./probe-plain.ts";\nexport type Hint = (typeof HTTP_METHOD_HINTS)[number];',
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
      ],
    });
  });

  describe("against a dependency whose public type owns the value set", () => {
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
          errors: [{ message: /derive the type from SSRTarget from vite\./u }],
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
  });

  describe("against a catalog and a dependency that both own the value set", () => {
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
  });

  describe("against two dependencies that both admit the value set", () => {
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
  });

  describe("against a catalog where two concepts share the values", () => {
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
});
