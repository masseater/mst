import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { buildCatalog } from "../lib/canonical-values/catalog.ts";
import { fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import { createNoLocalFiniteValueSet } from "./no-local-finite-value-set--use-or-register-canonical-values.ts";

const canonicalItems = ["draft", "published"] as const;
const entry = {
  annotationStart: 0,
  binding: "ORDER_STATUSES",
  bindingStart: 40,
  conceptId: "order.status",
  declarationEnd: 92,
  declarationPath: "packages/vocabulary/src/status.ts",
  declarationStart: 38,
  fingerprint: fingerprintValues(canonicalItems),
  importRoutes: [],
  packageName: null,
  values: canonicalItems,
} as const;
const catalog = buildCatalog([
  entry,
  {
    ...entry,
    binding: "ORDER_STATUS_NAMES",
    conceptId: "order.status.name",
    declarationPath: "packages/vocabulary/src/status-name.ts",
  },
  {
    ...entry,
    binding: "STATE_CODES",
    conceptId: "state.code",
    declarationPath: "packages/vocabulary/src/state-code.ts",
    importRoutes: [
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["packages/vocabulary/src/state-code.ts"],
        specifier: "@vocabulary/state-code",
      },
    ],
  },
]);

const singleOwnerRule = createNoLocalFiniteValueSet({
  loadCatalog: () => buildCatalog([entry]),
  loadLibraryVocabulary: () => [],
});

const rule = createNoLocalFiniteValueSet({
  loadCatalog: () => catalog,
  loadLibraryVocabulary: () => [],
});

const libraryRule = createNoLocalFiniteValueSet({
  loadCatalog: () => buildCatalog([]),
  loadLibraryVocabulary: () => [
    {
      admitsUnnamedValues: false,
      declarationId: "types-one#Status",
      packageName: "types-one",
      typeName: "Status",
      values: canonicalItems,
    },
    {
      admitsUnnamedValues: false,
      declarationId: "types-two#Status",
      packageName: "types-two",
      typeName: "Status",
      values: canonicalItems,
    },
  ],
});

const singleLibraryRule = createNoLocalFiniteValueSet({
  loadCatalog: () => buildCatalog([]),
  loadLibraryVocabulary: () => [
    {
      admitsUnnamedValues: false,
      declarationId: "types-one#Status",
      packageName: "types-one",
      typeName: "Status",
      values: canonicalItems,
    },
  ],
});

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values", () => {
  testLintRule(rule, {
    valid: [
      { code: 'const DISPLAY_ORDER = ["draft", "published"]; consume(DISPLAY_ORDER);' },
      { code: 'const hints = new Set(["alpha", "beta"]); consume(hints);' },
      { code: "const flag = { enum: [true, false] }; consume(flag);" },
      { code: 'z.enum(); z.union(); new Map(["draft", "published"]);' },
      { code: 'const statuses = new Set(); const loose = { ["enum"]: values };' },
      { code: "z.enum(values()); new Set(values()); const loose = { enum: values() };" },
      { code: "type Loose = string; type AlsoLoose = keyof string;" },
      { code: 'type Loose = (typeof STATUSES)["length"];' },
      { code: 'type Loose = keyof import("./shape.ts");' },
      { code: "const shape = { [name]: null }; z.enum(Object.keys(shape));" },
      { code: "z.enum(Object.values({ draft: null, published: null }));" },
      { code: "z.enum(Object.keys(makeShape()));" },
      { code: "z.enum(Object.keys());" },
      { code: "z.enum(Other.keys({ draft: null, published: null }));" },
      { code: 'z.enum(["draft", value]);' },
      { code: "z.enum(UNKNOWN_VALUES);" },
      { code: "z.enum(Object.keys(UNKNOWN_SHAPE));" },
      { code: "z.enum(Object.keys({ [name]: null, published: null }));" },
      { code: "type Loose = LocalValues[number];" },
      { code: "type Loose = keyof LocalShape;" },
      {
        code: 'import DefaultShape, * as Shapes from "./shape.ts"; void DefaultShape; void Shapes;',
      },
      { code: 'import { "shape" as Shape } from "./shape.ts"; void Shape;' },
      {
        code: 'import { ORDER_STATUSES } from "node:fs";\nexport const schema = z.enum(ORDER_STATUSES);',
      },
      {
        code: 'import { INTERNAL_SPELLINGS } from "./internal.ts";\nexport const spellings = new Set(INTERNAL_SPELLINGS);',
      },
      {
        code: 'import { INTERNAL_SPELLINGS } from "./internal.ts";\nexport type Spelling = (typeof INTERNAL_SPELLINGS)[number];',
      },
      { code: 'export type Loose = string | "draft";' },
      {
        code: 'export type Status = "draft" | "published";',
        filename: "/repo/src/status.test.ts",
        cwd: "/repo",
      },
    ],
    invalid: [
      {
        code: 'export const schema = z.enum(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwnerCandidates" }],
      },
      {
        code: 'const STATUSES = ["draft", "published"] as const;\nexport const schema = z.picklist(STATUSES);',
        errors: [{ messageId: "localFiniteValueSetWithOwnerCandidates" }],
      },
      {
        code: 'export type Status = "draft" | "published";',
        errors: [{ messageId: "localFiniteValueSetWithOwnerCandidates" }],
      },
      {
        code: 'export const schema = z.union([z.literal("draft"), z.literal("published")]);',
        errors: [{ messageId: "localFiniteValueSetWithOwnerCandidates" }],
      },
      {
        code: 'export const option = { enum: ["draft", "published"] };',
        errors: [{ messageId: "localFiniteValueSetWithOwnerCandidates" }],
      },
      {
        code: 'const STATUSES = ["draft", "published"] as const;\nexport type Status = (typeof STATUSES)[number];',
        errors: [{ messageId: "localFiniteValueSetWithOwnerCandidates" }],
      },
      {
        code: 'export const statuses = new Set(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwnerCandidates" }],
      },
      {
        code: 'import { ORDER_STATUSES } from "./shadow.ts";\nexport const statuses = new Set(ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        code: 'import { ORDER_STATUSES } from "./shadow.ts";\nexport type Status = (typeof ORDER_STATUSES)[number];',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        code: 'declare const ORDER_STATUSES: readonly ["shadow", "values"];\nexport const schema = z.enum(ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        code: "const SHAPE = { queued: null, running: null } as const;\nexport const schema = z.enum(Object.keys(SHAPE));",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        code: 'import { SHAPE } from "./shape.ts";\nexport const schema = z.enum(Object.keys(SHAPE));',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        code: "export const schema = z.enum(Object.keys({ draft: null, published: null }));",
        errors: [{ messageId: "localFiniteValueSetWithOwnerCandidates" }],
      },
      {
        code: 'import type { Shape } from "./shape.ts";\nexport type Status = keyof Shape;',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        code: 'import { type Shape } from "./shape.ts";\nexport type Status = keyof Shape;',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        code: 'export type Status = keyof import("./shape.ts").Shape;',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        code: 'export type Status = keyof import("./shape.ts").nested.Shape;',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
    ],
  });

  testLintRule(libraryRule, {
    valid: [],
    invalid: [
      {
        code: 'export type Status = "queued" | "running";',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        code: 'export type Status = "draft" | "published";',
        errors: [{ messageId: "localFiniteValueSetOwnedByLibraryTypeCandidates" }],
      },
    ],
  });

  testLintRule(singleOwnerRule, {
    valid: [],
    invalid: [
      {
        code: 'export const schema = z.enum(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });

  const declarationSource =
    '/** @canonical-values order.status */\nexport const VALUES = z.enum(["draft", "published"]);';
  const declarationStart = declarationSource.indexOf("export const");
  const declarationRule = createNoLocalFiniteValueSet({
    loadCatalog: () =>
      buildCatalog([
        {
          ...entry,
          annotationStart: 0,
          binding: "VALUES",
          bindingStart: declarationSource.indexOf("VALUES"),
          declarationPath: "src/owner.ts",
          declarationStart,
          declarationEnd: declarationSource.length,
        },
      ]),
    loadLibraryVocabulary: () => [],
  });

  testLintRule(declarationRule, {
    valid: [
      {
        code: declarationSource,
        cwd: "/repo",
        filename: "/repo/src/owner.ts",
      },
    ],
    invalid: [],
  });

  testLintRule(singleLibraryRule, {
    valid: [],
    invalid: [
      {
        code: 'export type Status = "draft" | "published";',
        errors: [{ messageId: "localFiniteValueSetOwnedByLibraryType" }],
      },
    ],
  });
});
