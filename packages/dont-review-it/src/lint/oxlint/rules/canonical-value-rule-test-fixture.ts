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

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { CanonicalValueImportedRouteClassifier } from "./canonical-value-route-origin.ts";

const ORDER_STATUS_VALUES: readonly CanonicalValue[] = ["draft", "published"];
const ORDER_OWNER_DECLARATION = 'export const ORDER_STATUSES = ["draft", "published"] as const;';
const ORDER_OWNER_CODE = `/** @canonical-values order-status */\n${ORDER_OWNER_DECLARATION}\nexport type OrderStatus = (typeof ORDER_STATUSES)[number];`;
const ORDER_OWNER_DECLARATION_START = ORDER_OWNER_CODE.indexOf(ORDER_OWNER_DECLARATION);
const ORDER_OWNER_DECLARATION_END = ORDER_OWNER_DECLARATION_START + ORDER_OWNER_DECLARATION.length;
const ORDER_BLANK_OWNER_CODE = `/** @canonical-values order-status */\n\n${ORDER_OWNER_DECLARATION}\nexport type OrderStatus = (typeof ORDER_STATUSES)[number];`;
const ORDER_BLANK_OWNER_DECLARATION_START = ORDER_BLANK_OWNER_CODE.indexOf(ORDER_OWNER_DECLARATION);
const ORDER_BLANK_OWNER_DECLARATION_END =
  ORDER_BLANK_OWNER_DECLARATION_START + ORDER_OWNER_DECLARATION.length;
const ORDER_OBJECT_OWNER_DECLARATION =
  'export const ORDER_OWNER = { values: ["draft", "published"] as const, nested: z.enum(["archived", "deleted"]) };';
const ORDER_OBJECT_OWNER_CODE = `/** @canonical-values order-status */\n${ORDER_OBJECT_OWNER_DECLARATION}`;
const ORDER_OBJECT_OWNER_DECLARATION_START = ORDER_OBJECT_OWNER_CODE.indexOf(
  ORDER_OBJECT_OWNER_DECLARATION,
);
const ORDER_OBJECT_OWNER_DECLARATION_END =
  ORDER_OBJECT_OWNER_DECLARATION_START + ORDER_OBJECT_OWNER_DECLARATION.length;
const PROPERTY_NAME_OWNER_DECLARATION =
  "export const ORDER_STATUS_MAP = { draft: 0, published: 1 } as const;";
const PROPERTY_NAME_OWNER_CODE = `/** @canonical-values order-status-map */\n${PROPERTY_NAME_OWNER_DECLARATION}\nexport type OrderStatus = keyof typeof ORDER_STATUS_MAP;`;
const PROPERTY_NAME_OWNER_DECLARATION_START = PROPERTY_NAME_OWNER_CODE.indexOf(
  PROPERTY_NAME_OWNER_DECLARATION,
);
const PROPERTY_NAME_OWNER_DECLARATION_END =
  PROPERTY_NAME_OWNER_DECLARATION_START + PROPERTY_NAME_OWNER_DECLARATION.length;

const entry = (
  conceptId: string,
  {
    annotationStart = 0,
    binding = "VALUES",
    bindingStart = 1,
    declarationEnd = 2,
    declarationStart = 1,
    exportName = binding,
    workspace,
    vocabulary,
  }: {
    readonly annotationStart?: number;
    readonly binding?: string;
    readonly bindingStart?: number;
    readonly declarationEnd?: number;
    readonly declarationStart?: number;
    readonly exportName?: string;
    readonly workspace: string;
    readonly vocabulary: readonly CanonicalValue[];
  },
): CanonicalValuesEntry => ({
  annotationStart,
  binding,
  bindingStart,
  conceptId,
  declarationEnd,
  declarationPath: `packages/${workspace}/src/${conceptId}.ts`,
  declarationStart,
  importRoutes: [
    {
      exportName,
      resolvedSourcePaths: [`packages/${workspace}/src/index.ts`],
      specifier: `@mst/${workspace}`,
    },
  ],
  packageName: `@mst/${workspace}`,
  values: vocabulary,
  fingerprint: fingerprintValues(vocabulary),
});

const orderOwnerEntry = entry("order-status", {
  annotationStart: 0,
  binding: "ORDER_STATUSES",
  bindingStart: ORDER_OWNER_CODE.indexOf("ORDER_STATUSES"),
  declarationEnd: ORDER_OWNER_DECLARATION_END,
  declarationStart: ORDER_OWNER_DECLARATION_START,
  workspace: "order-vocabulary",
  vocabulary: ORDER_STATUS_VALUES,
});

const ownedCatalog = buildCatalog([
  {
    ...orderOwnerEntry,
    importRoutes: [
      ...orderOwnerEntry.importRoutes,
      {
        exportName: "<module>",
        resolvedSourcePaths: ["packages/order-vocabulary/src/module.ts"],
        specifier: "@mst/order-vocabulary/module",
      },
    ],
  },
]);

const packageNameOf = (specifier: string): string =>
  specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : (specifier.split("/")[0] ?? specifier);

const testRouteClassifier: CanonicalValueImportedRouteClassifier = ({ catalog, route }) => {
  const publicEntries = catalog.entries.filter((candidate) =>
    candidate.importRoutes.some(
      (registered) =>
        registered.specifier === route.specifier && registered.exportName === route.importedName,
    ),
  );
  if (publicEntries.length !== 0) return { ...route, entries: publicEntries, kind: "registered" };

  const directSpecifier =
    route.specifier.startsWith("./") ||
    route.specifier.startsWith("../") ||
    route.specifier.startsWith("/");
  if (directSpecifier) {
    const specifierStem = route.specifier.replace(/\.[cm]?[jt]sx?$/u, "");
    const directEntries = catalog.entries.filter((candidate) => {
      const declarationStem = candidate.declarationPath
        .replace(/\.[cm]?[jt]sx?$/u, "")
        .split("/")
        .at(-1);
      return (
        candidate.binding === route.importedName &&
        declarationStem !== undefined &&
        specifierStem.endsWith(`/${declarationStem}`)
      );
    });
    return directEntries.length === 0
      ? { ...route, kind: "unregistered" }
      : { ...route, entries: directEntries, kind: "registered" };
  }

  return catalog.packageNames.has(packageNameOf(route.specifier)) || route.specifier.startsWith("#")
    ? { ...route, kind: "unregistered" }
    : { ...route, kind: "external" };
};

const ambiguousCatalog = buildCatalog([
  entry("order-status", { workspace: "order-vocabulary", vocabulary: ORDER_STATUS_VALUES }),
  entry("article-status", { workspace: "article-vocabulary", vocabulary: ORDER_STATUS_VALUES }),
]);

const libraryType = (
  packageName: string,
  {
    typeName,
    admits,
    admitsUnnamedValues = false,
  }: {
    readonly typeName: string;
    readonly admits: readonly CanonicalValue[];
    readonly admitsUnnamedValues?: boolean;
  },
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
    classifyImportedRoute: testRouteClassifier,
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
const withThreeValueOwner = ruleReading(
  buildCatalog([
    entry("workflow-status", {
      binding: "WORKFLOW_STATUSES",
      workspace: "workflow-vocabulary",
      vocabulary: ["draft", "published", "archived"],
    }),
  ]),
);
const withNullableOwner = ruleReading(
  buildCatalog([
    entry("nullable-status", {
      workspace: "nullable-vocabulary",
      vocabulary: ["draft", null],
    }),
  ]),
);
const withNumericOwner = ruleReading(
  buildCatalog([entry("retry-budget", { workspace: "retry-vocabulary", vocabulary: [-1, 1] })]),
);
const withBlankOwner = ruleReading(
  buildCatalog([
    entry("order-status", {
      annotationStart: 0,
      binding: "ORDER_STATUSES",
      bindingStart: ORDER_BLANK_OWNER_CODE.indexOf("ORDER_STATUSES"),
      declarationEnd: ORDER_BLANK_OWNER_DECLARATION_END,
      declarationStart: ORDER_BLANK_OWNER_DECLARATION_START,
      workspace: "order-vocabulary",
      vocabulary: ORDER_STATUS_VALUES,
    }),
  ]),
);
const withObjectOwner = ruleReading(
  buildCatalog([
    entry("order-status", {
      annotationStart: 0,
      binding: "ORDER_OWNER",
      bindingStart: ORDER_OBJECT_OWNER_CODE.indexOf("ORDER_OWNER"),
      declarationEnd: ORDER_OBJECT_OWNER_DECLARATION_END,
      declarationStart: ORDER_OBJECT_OWNER_DECLARATION_START,
      workspace: "order-vocabulary",
      vocabulary: ORDER_STATUS_VALUES,
    }),
  ]),
);
const withPropertyNameOwner = ruleReading(
  buildCatalog([
    entry("order-status-map", {
      annotationStart: 0,
      binding: "ORDER_STATUS_MAP",
      bindingStart: PROPERTY_NAME_OWNER_CODE.indexOf("ORDER_STATUS_MAP"),
      declarationEnd: PROPERTY_NAME_OWNER_DECLARATION_END,
      declarationStart: PROPERTY_NAME_OWNER_DECLARATION_START,
      workspace: "property-name-vocabulary",
      vocabulary: ORDER_STATUS_VALUES,
    }),
  ]),
);
const withoutCatalog = ruleReading(EMPTY_CANONICAL_VALUES_CATALOG);
const withoutEntriesInRepositoryPackage = ruleReading(buildCatalog([], ["@mst/order-vocabulary"]));
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

export {
  ORDER_BLANK_OWNER_CODE,
  ORDER_OBJECT_OWNER_CODE,
  ORDER_OWNER_CODE,
  PROPERTY_NAME_OWNER_CODE,
  ownedCatalog,
  testRouteClassifier,
  withAmbiguousOwners,
  withBlankOwner,
  withCatalogAndLibraryOwners,
  withLibraryOwner,
  withNullableOwner,
  withNumericOwner,
  withObjectOwner,
  withOwner,
  withPropertyNameOwner,
  withTwoLibraryOwners,
  withThreeValueOwner,
  withoutCatalog,
  withoutEntriesInRepositoryPackage,
};
