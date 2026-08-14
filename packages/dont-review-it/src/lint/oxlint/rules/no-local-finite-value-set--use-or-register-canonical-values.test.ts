import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { buildCatalog } from "../lib/canonical-values/catalog.ts";
import { fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { EMPTY_LIBRARY_VOCABULARY_INDEX } from "../lib/library-vocabulary/vocabulary-index.ts";
import { createNoLocalFiniteValueSet } from "./no-local-finite-value-set--use-or-register-canonical-values.ts";

const orderStatusValues = ["draft", "published"] as const;

const orderStatusEntry = {
  annotationStart: 0,
  binding: "ORDER_STATUSES",
  bindingStart: 40,
  conceptId: "order.status",
  declarationEnd: 92,
  declarationPath: "packages/vocabulary/src/status.ts",
  declarationStart: 38,
  fingerprint: fingerprintValues(orderStatusValues),
  importRoutes: [],
  packageName: null,
  values: orderStatusValues,
} as const;

const ambiguousOwnersCatalog = buildCatalog([
  orderStatusEntry,
  {
    ...orderStatusEntry,
    binding: "ORDER_STATUS_NAMES",
    conceptId: "order.status.name",
    declarationPath: "packages/vocabulary/src/status-name.ts",
  },
  {
    ...orderStatusEntry,
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

const withAmbiguousOwners = createNoLocalFiniteValueSet({
  loadCatalog: () => ambiguousOwnersCatalog,
  loadLibraryVocabulary: () => EMPTY_LIBRARY_VOCABULARY_INDEX,
});

const withOwner = createNoLocalFiniteValueSet({
  loadCatalog: () => buildCatalog([orderStatusEntry]),
  loadLibraryVocabulary: () => EMPTY_LIBRARY_VOCABULARY_INDEX,
});

const withTwoLibraryOwners = createNoLocalFiniteValueSet({
  loadCatalog: () => buildCatalog([]),
  loadLibraryVocabulary: () => [
    {
      admitsUnnamedValues: false,
      declarationId: "types-one#Status",
      packageName: "types-one",
      typeName: "Status",
      values: orderStatusValues,
    },
    {
      admitsUnnamedValues: false,
      declarationId: "types-two#Status",
      packageName: "types-two",
      typeName: "Status",
      values: orderStatusValues,
    },
  ],
});

const withLibraryOwner = createNoLocalFiniteValueSet({
  loadCatalog: () => buildCatalog([]),
  loadLibraryVocabulary: () => [
    {
      admitsUnnamedValues: false,
      declarationId: "types-one#Status",
      packageName: "types-one",
      typeName: "Status",
      values: orderStatusValues,
    },
  ],
});

const repositoryRoot = findWorkspaceRoot(process.cwd());

const engineValues = ["claude", "codex"] as const;

const withWorkspaceRootedOwner = createNoLocalFiniteValueSet({
  loadCatalog: () =>
    buildCatalog([
      {
        ...orderStatusEntry,
        binding: "ENGINES",
        conceptId: "auto-develop.engine",
        declarationPath: "packages/auto-develop/src/config/engine.ts",
        fingerprint: fingerprintValues(engineValues),
        importRoutes: [
          {
            exportName: "ENGINE_NAMES",
            resolvedSourcePaths: ["packages/auto-develop/src/config/engine.ts"],
            specifier: "@mst/auto-develop/engine",
          },
        ],
        values: engineValues,
      },
    ]),
  loadLibraryVocabulary: () => EMPTY_LIBRARY_VOCABULARY_INDEX,
});

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values", () => {
  describe("against a catalog where several concepts share the values", () => {
    testLintRule(withAmbiguousOwners, {
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
          code: 'const LocalShape = ["draft", "published"] as const; type Loose = keyof LocalShape;',
        },
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
        {
          name: "a union that also admits any string names no finite vocabulary",
          documented: true,
          code: 'export type Loose = string | "draft";',
        },
        {
          name: "a spec file is not a production source",
          documented: true,
          code: 'export type Status = "draft" | "published";',
          filename: "/repo/src/status.test.ts",
          cwd: "/repo",
        },
      ],
      invalid: [
        {
          name: "a finite vocabulary written into a schema call defines it here",
          documented: true,
          code: 'export const schema = z.enum(["draft", "published"]);',
          errors: [{ messageId: "localFiniteValueSetWithOwnerCandidates" }],
        },
        {
          code: 'const STATUSES = ["draft", "published"] as const;\nexport const schema = z.picklist(STATUSES);',
          errors: [{ messageId: "localFiniteValueSetWithOwnerCandidates" }],
        },
        {
          name: "a literal union type defines the same vocabulary over again",
          documented: true,
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
  });

  describe("against two dependencies that both admit the value set", () => {
    testLintRule(withTwoLibraryOwners, {
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
  });

  describe("against a catalog whose single concept owns the value set", () => {
    testLintRule(withOwner, {
      valid: [],
      invalid: [
        {
          code: 'export const schema = z.enum(["draft", "published"]);',
          errors: [{ messageId: "localFiniteValueSetWithOwner" }],
        },
      ],
    });
  });

  describe("against the annotated declaration that owns the concept", () => {
    const declarationSource =
      '/** @canonical-values order.status */\nexport const VALUES = z.enum(["draft", "published"]);';
    const declarationStart = declarationSource.indexOf("export const");
    const withAnnotatedDeclarationOwner = createNoLocalFiniteValueSet({
      loadCatalog: () =>
        buildCatalog([
          {
            ...orderStatusEntry,
            annotationStart: 0,
            binding: "VALUES",
            bindingStart: declarationSource.indexOf("VALUES"),
            declarationPath: "src/owner.ts",
            declarationStart,
            declarationEnd: declarationSource.length,
          },
        ]),
      loadLibraryVocabulary: () => EMPTY_LIBRARY_VOCABULARY_INDEX,
    });

    testLintRule(withAnnotatedDeclarationOwner, {
      valid: [
        {
          code: declarationSource,
          cwd: "/repo",
          filename: "/repo/src/owner.ts",
        },
      ],
      invalid: [],
    });
  });

  describe("against one dependency that admits the value set", () => {
    testLintRule(withLibraryOwner, {
      valid: [],
      invalid: [
        {
          code: 'export type Status = "draft" | "published";',
          errors: [{ messageId: "localFiniteValueSetOwnedByLibraryType" }],
        },
      ],
    });
  });

  describe("against an owner reached through the workspace root", () => {
    testLintRule(withWorkspaceRootedOwner, {
      valid: [
        {
          code: 'import { ENGINES } from "./config/engine.ts";\nexport const schema = z.enum(ENGINES);',
          cwd: repositoryRoot,
          filename: join(repositoryRoot, "packages/auto-develop/src/direct-engine-schema.ts"),
        },
        {
          code: 'import { SHADOW as LOCAL_ENGINES } from "./config/engine.ts";\nexport function schema(LOCAL_ENGINES: readonly ["shadow", "values"]) { return z.enum(LOCAL_ENGINES); }',
          cwd: repositoryRoot,
          filename: join(repositoryRoot, "packages/auto-develop/src/shadow-engine-schema.ts"),
        },
      ],
      invalid: [
        {
          code: 'import { ENGINES } from "./config/engine.ts";\nexport function schema(ENGINES: readonly ["shadow", "values"]) { return z.enum(ENGINES); }',
          cwd: repositoryRoot,
          filename: join(repositoryRoot, "packages/auto-develop/src/shadow-engine-schema.ts"),
          errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
        },
        {
          code: 'import { ENGINES } from "./config/engine.ts";\nexport function schema() { const ENGINES = ["shadow", "values"] as const; return z.enum(ENGINES); }',
          cwd: repositoryRoot,
          filename: join(repositoryRoot, "packages/auto-develop/src/shadow-engine-schema.ts"),
          errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
        },
        {
          code: 'import { ENGINES } from "./config/engine.ts";\nexport function schema(ENGINES: { shadow: null; values: null }) { return z.enum(Object.keys(ENGINES)); }',
          cwd: repositoryRoot,
          filename: join(repositoryRoot, "packages/auto-develop/src/shadow-engine-schema.ts"),
          errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
        },
        {
          code: 'import { ENGINE_NAMES } from "./config/engine.ts";\nexport function schema(ENGINE_NAMES: readonly ["shadow", "values"]) { return z.enum(ENGINE_NAMES); }',
          cwd: repositoryRoot,
          filename: join(repositoryRoot, "packages/auto-develop/src/shadow-engine-schema.ts"),
          errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
        },
        {
          code: 'import { ENGINES } from "./config/engine.ts";\ndeclare const ENGINES: readonly ["shadow", "values"];\nexport const schema = z.enum(ENGINES);',
          cwd: repositoryRoot,
          filename: join(repositoryRoot, "packages/auto-develop/src/shadow-engine-schema.ts"),
          errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
        },
        {
          code: 'declare const ENGINE_NAMES: readonly ["shadow", "values"];\nexport const schema = z.enum(ENGINE_NAMES);',
          cwd: repositoryRoot,
          filename: join(repositoryRoot, "packages/auto-develop/src/shadow-engine-schema.ts"),
          errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
        },
        {
          code: 'import { ENGINES as LOCAL_ENGINES } from "./config/engine.ts";\nexport function schema(LOCAL_ENGINES: readonly ["shadow", "values"]) { return z.enum(LOCAL_ENGINES); }',
          cwd: repositoryRoot,
          filename: join(repositoryRoot, "packages/auto-develop/src/shadow-engine-schema.ts"),
          errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
        },
        {
          code: 'import { ENGINE_NAMES as LOCAL_ENGINES } from "./config/engine.ts";\nexport function schema(LOCAL_ENGINES: readonly ["shadow", "values"]) { return z.enum(LOCAL_ENGINES); }',
          cwd: repositoryRoot,
          filename: join(repositoryRoot, "packages/auto-develop/src/shadow-engine-schema.ts"),
          errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
        },
      ],
    });
  });

  describe("against a dependency vocabulary read while the rule is set up for the file", () => {
    const dependencyVocabularyReads = [EMPTY_LIBRARY_VOCABULARY_INDEX].values();
    const withCountedDependencyReads = createNoLocalFiniteValueSet({
      loadCatalog: () => buildCatalog([]),
      loadLibraryVocabulary: () => {
        const read = dependencyVocabularyReads.next();
        if (read.done === true) {
          throw new Error("Library vocabulary was read again while the file was being walked");
        }
        return read.value;
      },
    });

    testLintRule(
      {
        ...withCountedDependencyReads,
        create(ruleContext: Parameters<typeof withCountedDependencyReads.create>[0]) {
          const visitor = withCountedDependencyReads.create(ruleContext);
          if (dependencyVocabularyReads.next().done !== true) {
            throw new Error("Library vocabulary was not read while the rule was being set up");
          }
          return visitor;
        },
      },
      {
        valid: [],
        invalid: [
          {
            code: 'export const schema = z.enum(["draft", "published"]);',
            errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
          },
        ],
      },
    );
  });
});
