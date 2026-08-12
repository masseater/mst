import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import {
  EMPTY_CANONICAL_VALUES_CATALOG,
  type CanonicalValuesEntry,
} from "../lib/canonical-values/catalog.ts";
import { fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import { createCanonicalValueDomainResolver } from "./canonical-value-domain.ts";
import { withOwner, withoutCatalog } from "./canonical-value-rule-test-fixture.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueOriginProjection } from "./canonical-value-property-origin.ts";
import type { CanonicalValueRouteOrigin } from "./canonical-value-route-origin.ts";

const ROUTE_NODE: ESTree.ArrayExpression = {
  end: 2,
  elements: [],
  loc: {
    end: { column: 2, line: 1 },
    start: { column: 1, line: 1 },
  },
  parent: null as never,
  range: [1, 2],
  start: 1,
  type: "ArrayExpression",
};

const ENTRY: CanonicalValuesEntry = {
  annotationStart: 0,
  binding: "BASE",
  bindingStart: 1,
  conceptId: "domain-base",
  declarationEnd: 2,
  declarationPath: "packages/domain-vocabulary/src/base.ts",
  declarationStart: 1,
  fingerprint: fingerprintValues(["alpha", "omega", "zeta"]),
  importRoutes: [
    {
      exportName: "BASE",
      resolvedSourcePaths: ["packages/domain-vocabulary/src/index.ts"],
      specifier: "@mst/domain-vocabulary",
    },
  ],
  packageName: "@mst/domain-vocabulary",
  values: ["alpha", "omega", "zeta"],
};

const registeredRoute = (
  valueProjections: readonly CanonicalValueOriginProjection[],
): Extract<CanonicalValueRouteOrigin, { readonly kind: "registered" }> => ({
  entries: [ENTRY],
  importedName: "BASE",
  kind: "registered",
  node: ROUTE_NODE,
  specifier: "@mst/domain-vocabulary",
  valueProjections,
});

const domain = createCanonicalValueDomainResolver({
  bindingIndex: null as never,
  catalog: EMPTY_CANONICAL_VALUES_CATALOG,
  filename: "/repo/packages/example/src/status.ts",
  invocationState: null as never,
  propertyState: null as never,
  repositoryRoot: "/repo",
});

describe("canonical value registered route projections", () => {
  test("an unprojected registered route remains registered", () => {
    expect(domain.route(registeredRoute([]))).toStrictEqual({
      candidates: [registeredRoute([])],
      complete: true,
    });
  });

  test("an identity array projection remains registered", () => {
    const route = registeredRoute([{ kind: "array-slice", startIndex: 0 }]);
    expect(domain.route(route)).toStrictEqual({ candidates: [route], complete: true });
  });

  test("an array tail becomes a local contribution derived from its registered route", () => {
    expect(domain.route(registeredRoute([{ kind: "array-slice", startIndex: 1 }]))).toStrictEqual({
      candidates: [
        {
          catalogBindingContribution: false,
          derivedFromRegisteredRoute: true,
          kind: "values",
          localContribution: true,
          node: ROUTE_NODE,
          values: ["omega", "zeta"],
        },
      ],
      complete: true,
    });
  });

  test("an object rest becomes a local contribution with excluded owner keys removed", () => {
    expect(
      domain.route(registeredRoute([{ excludedKeys: ["alpha"], kind: "object-rest" }])),
    ).toStrictEqual({
      candidates: [
        {
          catalogBindingContribution: false,
          derivedFromRegisteredRoute: true,
          kind: "values",
          localContribution: true,
          node: ROUTE_NODE,
          values: ["omega", "zeta"],
        },
      ],
      complete: true,
    });
  });

  test("an opaque value projection cannot retain the registered exemption", () => {
    expect(domain.route(registeredRoute([{ kind: "property", path: ["nested"] }]))).toStrictEqual({
      candidates: [
        {
          catalogBindingContribution: false,
          derivedFromRegisteredRoute: true,
          kind: "values",
          localContribution: true,
          node: ROUTE_NODE,
          values: ["alpha", "omega", "zeta"],
        },
      ],
      complete: true,
    });
  });
});

describe("canonical value incomplete collection domains", () => {
  testLintRule(withOwner, {
    valid: [],
    invalid: [
      {
        name: "an unknown trailing spread cannot erase known enum values",
        code: 'export const schema = z.enum(["draft", "published", ...runtimeValues]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an unknown leading spread cannot erase known enum values",
        code: 'export const schema = z.enum([...runtimeValues, "draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an unknown trailing spread cannot erase an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nexport const schema = z.enum([...ORDER_STATUSES, ...runtimeValues]);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an unknown leading spread cannot erase an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nexport const schema = z.enum([...runtimeValues, ...ORDER_STATUSES]);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an unknown trailing schema cannot erase known literal alternatives",
        code: 'export const schema = z.union([z.literal("draft"), z.literal("published"), runtimeSchema]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an unknown leading schema cannot erase known literal alternatives",
        code: 'export const schema = z.union([runtimeSchema, z.literal("draft"), z.literal("published")]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});

describe("canonical value static call domains", () => {
  testLintRule(withOwner, {
    valid: [],
    invalid: [
      {
        name: "a static string concat retains its catalog owner",
        code: 'export const schema = z.enum(["dra".concat("ft"), "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a static array join retains its catalog owner",
        code: 'export const schema = z.enum(["draft", ["pub", "lished"].join("")]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an unknown value cannot erase a static string call vocabulary",
        code: 'export const schema = z.enum(["dra".concat("ft"), ["pub", "lished"].join(""), runtimeStatus]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });

  testLintRule(withoutCatalog, {
    valid: [],
    invalid: [
      {
        name: "static string calls remain local without a matching catalog owner",
        code: 'export const schema = z.enum(["dra".concat("ft"), ["pub", "lished"].join("")]);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
    ],
  });
});

describe("canonical value derived primitive domains", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "a replaced Number formatter remains unknown",
        code: "Number.prototype.toFixed = () => runtimeValue(); export const schema = z.enum([(1).toFixed(), (2).toFixed()]);",
      },
      {
        name: "a replaced RegExp getter remains unknown",
        code: 'Object.defineProperty(RegExp.prototype, "source", { get: () => runtimeValue() }); export const schema = z.enum([/draft/u.source, /published/u.source]);',
      },
    ],
    invalid: [
      {
        name: "RegExp source spellings retain their catalog owner",
        code: "export const schema = z.enum([/draft/u.source, /published/u.source]);",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "named functions expose a finite vocabulary",
        code: "export const schema = z.enum([(function draft() {}).name, (function published() {}).name]);",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "named classes expose a finite vocabulary",
        code: "export const schema = z.enum([(class draft {}).name, (class published {}).name]);",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "primitive toString results expose a finite vocabulary",
        code: "export const schema = z.enum([(1).toString(), (-1).toString()]);",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "RegExp flags expose a finite vocabulary",
        code: "export const schema = z.enum([/x/u.flags, /x/g.flags]);",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Number formatters expose a finite vocabulary",
        code: "export const schema = z.enum([(1).toFixed(), (2).toPrecision(1), (3).toExponential(0)]);",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a formatter replacement after the schema does not change its vocabulary",
        code: "export const schema = z.enum([(1).toFixed(), (2).toFixed()]); Number.prototype.toFixed = () => runtimeValue();",
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an uncalled getter replacement does not change its vocabulary",
        code: 'function replace() { Object.defineProperty(RegExp.prototype, "source", { get: () => runtimeValue() }); } export const schema = z.enum([/draft/u.source, /published/u.source]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});
