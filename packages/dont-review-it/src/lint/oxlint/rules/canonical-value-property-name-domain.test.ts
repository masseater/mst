import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { buildCatalog } from "../lib/canonical-values/catalog.ts";
import { fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import { EMPTY_LIBRARY_VOCABULARY_INDEX } from "../lib/library-vocabulary/vocabulary-index.ts";
import {
  PROPERTY_NAME_OWNER_CODE,
  withPropertyNameOwner,
  withoutCatalog,
} from "./canonical-value-rule-test-fixture.ts";
import { createNoLocalFiniteValueSet } from "./no-local-finite-value-set--use-or-register-canonical-values.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: property-name domain", () => {
  testLintRule(withPropertyNameOwner, {
    valid: [
      {
        name: "the exact object owner initializer stays exempt",
        code: PROPERTY_NAME_OWNER_CODE,
        filename: "/repo/packages/property-name-vocabulary/src/order-status-map.ts",
        cwd: "/repo",
      },
      {
        name: "a registered import type property set stays derived",
        code: 'export type Status = keyof typeof import("@mst/property-name-vocabulary").ORDER_STATUS_MAP;',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
      },
      {
        name: "an index signature keeps a type property set open",
        code: "type Shape = { draft: 0; published: 1; [key: string]: unknown };\ntype Status = keyof Shape;",
      },
      {
        name: "an open Object.keys domain does not satisfy a Set fingerprint",
        code: "const shape = { draft: 0, published: 1, ...runtimeShape() };\nnew Set(Object.keys(shape));",
      },
      {
        name: "a shadowed Object constructor is not the built-in Object.keys",
        code: "const Object = { keys: (_value) => runtimeValues() };\nz.enum(Object.keys({ draft: 0, published: 1 }));",
      },
      {
        name: "Object.keys excludes non-enumerable static class methods",
        code: "z.enum(Object.keys(class { static draft() {} static published() {} }));",
      },
      {
        name: "Object.keys excludes a class method from a singleton static field set",
        code: "z.enum(Object.keys(class { static draft = 0; static published() {} }));",
      },
      {
        name: "Object.keys excludes declared static class fields",
        code: "z.enum(Object.keys(class { declare static draft: number; declare static published: number }));",
      },
    ],
    invalid: [
      {
        name: "keyof typeof a local object exposes its property vocabulary",
        code: "const shape = { draft: 0, published: 1 };\nexport type Status = keyof typeof shape;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof an inline type literal exposes its property vocabulary",
        code: "export type Status = keyof { draft: 0; published: 1 };",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof a type alias exposes its property vocabulary",
        code: "type Shape = { draft: 0; published: 1 };\nexport type Status = keyof Shape;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof an interface exposes its property vocabulary",
        code: "interface Shape { draft: 0; published: 1 }\nexport type Status = keyof Shape;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof a merged interface combines its declarations",
        code: "interface Shape { draft: 0 }\ninterface Shape { published: 1 }\nexport type Status = keyof Shape;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof a class exposes its public instance property vocabulary",
        code: "class Shape { draft = 0; published = 1; }\nexport type Status = keyof Shape;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof typeof a namespace exposes its exported member vocabulary",
        code: "namespace Shape { export const draft = 0; export const published = 1; }\nexport type Status = keyof typeof Shape;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof typeof an enum exposes its member vocabulary",
        code: 'enum Shape { draft = "draft", published = "published" }\nexport type Status = keyof typeof Shape;',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an automatic enum and its keyof type keep their distinct vocabularies",
        code: "enum Shape { draft, published }\nexport type Status = keyof typeof Shape;",
        errors: [
          { messageId: "localFiniteValueSetWithoutOwner" },
          { messageId: "localFiniteValueSetWithOwner" },
        ],
      },
      {
        name: "keyof an inherited interface includes base properties",
        code: "interface DraftShape { draft: 0 }\ninterface Shape extends DraftShape { published: 1 }\nexport type Status = keyof Shape;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof an inherited class includes base instance properties",
        code: "class DraftShape { draft = 0 }\nclass Shape extends DraftShape { published = 1 }\nexport type Status = keyof Shape;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof typeof an inherited class includes base static properties",
        code: "class DraftShape { static draft = 0 }\nclass Shape extends DraftShape { static published = 1 }\nexport type Status = keyof typeof Shape;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof an intersection combines member properties",
        code: "type Draft = { draft: 0 };\ntype Published = { published: 1 };\nexport type Status = keyof (Draft & Published);",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof a union keeps properties shared by every member",
        code: "type Left = { draft: 0; published: 1 };\ntype Right = { draft: 1; published: 0 };\nexport type Status = keyof (Left | Right);",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof a Readonly wrapper keeps the property vocabulary",
        code: "type Shape = { draft: 0; published: 1 };\nexport type Status = keyof Readonly<Shape>;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof a Partial wrapper keeps the property vocabulary",
        code: "type Shape = { draft: 0; published: 1 };\nexport type Status = keyof Partial<Shape>;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof a Required wrapper keeps the property vocabulary",
        code: "type Shape = { draft?: 0; published?: 1 };\nexport type Status = keyof Required<Shape>;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof a generic alias keeps the property vocabulary",
        code: "type Shape<Value> = { draft: Value; published: Value };\nexport type Status = keyof Shape<number>;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a static computed type key contributes to the property vocabulary",
        code: 'const first = "draft";\ntype Shape = { [first]: 0; published: 1 };\nexport type Status = keyof Shape;',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "object spread and alias resolution preserve computed property names",
        code: 'const first = "draft";\nconst base = { [first]: 0 };\nconst alias = base;\nconst shape = { ...alias, published: 1 };\nz.enum(Object.keys(shape));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.keys passed to a schema enum exposes the local property vocabulary",
        code: "z.enum(Object.keys({ draft: 0, published: 1 }));",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.keys passed to Set exposes the local property vocabulary",
        code: "new Set(Object.keys({ draft: 0, published: 1 }));",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.keys excludes an object literal prototype setter",
        code: "z.enum(Object.keys({ __proto__: null, draft: 0, published: 1 }));",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.keys includes a computed proto property",
        code: 'z.enum(Object.keys({ ["__proto__"]: null, draft: 0, published: 1 }));',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Object.keys includes a shorthand proto property",
        code: "const __proto__ = null; z.enum(Object.keys({ __proto__, draft: 0, published: 1 }));",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a shorthand proto completes a two-value Object.keys vocabulary",
        code: "const __proto__ = null; z.enum(Object.keys({ __proto__, draft: 0 }));",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Object.keys includes private static TypeScript fields at runtime",
        code: "z.enum(Object.keys(class { private static draft = 0; static published = 1 }));",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.keys includes protected static TypeScript fields at runtime",
        code: "z.enum(Object.keys(class { protected static draft = 0; static published = 1 }));",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.keys preserves known keys beside an unknown computed key",
        code: "declare const unknownKey: string;\nz.enum(Object.keys({ draft: 0, published: 1, [unknownKey]: 2 }));",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.keys preserves known keys beside an unknown spread",
        code: "const shape = { draft: 0, published: 1, ...runtimeShape() };\nz.enum(Object.keys(shape));",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.keys preserves known keys beside an external spread",
        code: 'import { RUNTIME } from "external-package";\nconst shape = { draft: 0, published: 1, ...RUNTIME };\nz.enum(Object.keys(shape));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an alias of Object.keys preserves the property vocabulary",
        code: "const keysOf = Object.keys;\nz.enum(keysOf({ draft: 0, published: 1 }));",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a destructured Object.keys preserves the property vocabulary",
        code: "const { keys } = Object;\nz.enum(keys({ draft: 0, published: 1 }));",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.keys.call preserves the property vocabulary",
        code: "z.enum(Object.keys.call(Object, { draft: 0, published: 1 }));",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "keyof typeof an unregistered import namespace keeps its route provenance",
        code: 'export type Status = keyof typeof import("@mst/property-name-vocabulary/shadow");',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an unregistered spread route survives a later unknown spread",
        code: 'import { SHADOW } from "@mst/property-name-vocabulary/shadow";\nconst shape = { ...SHADOW, ...runtimeShape() };\nz.enum(Object.keys(shape));',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "the same property vocabulary nested inside an owner declaration is not exempt",
        code: "export const OWNER = { nested: { draft: 0, published: 1 } };\nexport type Status = keyof typeof OWNER.nested;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: unowned property-name domain", () => {
  testLintRule(withoutCatalog, {
    valid: [],
    invalid: [
      {
        name: "keyof an unowned object literal still defines a vocabulary",
        code: "export type Status = keyof { draft: 0; published: 1 };",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "keyof an unowned interface still defines a vocabulary",
        code: "interface Shape { draft: 0; published: 1 }\nexport type Status = keyof Shape;",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "keyof an unowned class still defines a vocabulary",
        code: "class Shape { draft = 0; published = 1 }\nexport type Status = keyof Shape;",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
    ],
  });
});

const numericValues = [1, 2] as const;

const numericPropertyNameRule = createNoLocalFiniteValueSet({
  loadCatalog: () =>
    buildCatalog([
      {
        annotationStart: 0,
        binding: "NUMBERS",
        bindingStart: 1,
        conceptId: "numeric-keys",
        declarationEnd: 2,
        declarationPath: "packages/numeric-vocabulary/src/numbers.ts",
        declarationStart: 1,
        fingerprint: fingerprintValues(numericValues),
        importRoutes: [],
        packageName: "@mst/numeric-vocabulary",
        values: numericValues,
      },
    ]),
  loadLibraryVocabulary: () => EMPTY_LIBRARY_VOCABULARY_INDEX,
});

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: numeric property names", () => {
  testLintRule(numericPropertyNameRule, {
    valid: [],
    invalid: [
      {
        name: "keyof preserves numeric literal property identity",
        code: "export type NumericKey = keyof { 1: 0; 2: 0 };",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});
