import { mapCandidateSet, type CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import {
  importRouteStatus,
  registeredEntriesForImportRoute,
} from "../lib/canonical-values/import-route.ts";
import { PROPERTY_PATH_WILDCARD } from "../lib/canonical-values/property-path.ts";
import { type CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import { canonicalValueImportDeclarationOf } from "./canonical-value-import-definition.ts";
import {
  canonicalValueModuleImportFromDefinition,
  canonicalValueModuleImportFromExpression,
} from "./canonical-value-module-import.ts";
import {
  canonicalValueOriginProjectionKey,
  canonicalValueOriginKey,
  type CanonicalValueExpressionOrigin,
  type CanonicalValueOrigin,
  type CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";
import { canonicalValueUnregisteredRouteFromUnresolvedOrigin } from "./canonical-value-unresolved-route.ts";

import type { Definition, ESTree } from "@oxlint/plugins";
import type {
  CanonicalValuesCatalog,
  CanonicalValuesEntry,
} from "../lib/canonical-values/catalog.ts";

const DYNAMIC_IMPORTED_NAME = "<computed>";

export type CanonicalValueImportedRoute = {
  readonly importedName: string;
  readonly node: ESTree.Span;
  readonly specifier: string;
  readonly valueProjections: readonly CanonicalValueOriginProjection[];
};

export const canonicalValueImportedRouteCallableName = (
  route: CanonicalValueImportedRoute,
): string | null => {
  if (route.importedName !== "default") return route.importedName;
  const paths = route.valueProjections.flatMap((projection) =>
    projection.kind === "property" ? projection.path : [],
  );
  return paths.length === 1 && typeof paths[0] === "string" ? paths[0] : null;
};

export type CanonicalValueRouteOrigin =
  | {
      readonly entries: readonly CanonicalValuesEntry[];
      readonly importedName: string;
      readonly kind: "registered";
      readonly node: ESTree.Span;
      readonly specifier: string;
      readonly valueProjections: readonly CanonicalValueOriginProjection[];
    }
  | {
      readonly importedName: string;
      readonly kind: "unregistered";
      readonly node: ESTree.Span;
      readonly specifier: string;
      readonly valueProjections: readonly CanonicalValueOriginProjection[];
    }
  | {
      readonly importedName: string;
      readonly kind: "external";
      readonly node: ESTree.Span;
      readonly specifier: string;
      readonly valueProjections: readonly CanonicalValueOriginProjection[];
    }
  | { readonly kind: "local"; readonly origin: CanonicalValueOrigin };

type CanonicalValueImportedRouteClassification = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly catalog: CanonicalValuesCatalog;
  readonly filename: string;
  readonly repositoryRoot: string;
  readonly route: CanonicalValueImportedRoute;
};

export type CanonicalValueImportedRouteClassifier = (
  input: CanonicalValueImportedRouteClassification,
) => CanonicalValueRouteOrigin;

export const canonicalValueImportedSpecifierName = (
  specifier: ESTree.ImportSpecifier,
): string | null =>
  specifier.imported.type === "Identifier"
    ? specifier.imported.name
    : typeof specifier.imported.value === "string"
      ? specifier.imported.value
      : null;

const namespaceRoute = ({
  origin,
  specifier,
  unprojectedImportedName,
}: {
  readonly origin: CanonicalValueExpressionOrigin;
  readonly specifier: string;
  readonly unprojectedImportedName: string;
}): CanonicalValueImportedRoute | null => {
  const [selection, ...remainingProjections] = origin.projections;
  if (selection === undefined) {
    return {
      importedName: unprojectedImportedName,
      node: origin.expression,
      specifier,
      valueProjections: [],
    };
  }
  if (selection.kind !== "property") {
    return {
      importedName: unprojectedImportedName,
      node: origin.expression,
      specifier,
      valueProjections: origin.projections,
    };
  }
  const [selectedMember, ...remainingPath] = selection.path;
  if (selectedMember === undefined) return null;
  const importedName =
    selectedMember === PROPERTY_PATH_WILDCARD ? DYNAMIC_IMPORTED_NAME : selectedMember;
  const valueProjections: readonly CanonicalValueOriginProjection[] = [
    ...(remainingPath.length === 0 ? [] : [{ kind: "property" as const, path: remainingPath }]),
    ...remainingProjections,
  ];
  return { importedName, node: origin.expression, specifier, valueProjections };
};

const routeFromDirectImport = (
  origin: CanonicalValueExpressionOrigin,
  definition: Definition,
): CanonicalValueImportedRoute | null => {
  const declaration = canonicalValueImportDeclarationOf(definition);
  const node = definition.node;
  if (node.type === "ImportDefaultSpecifier" && declaration !== null) {
    return {
      importedName: "default",
      node: origin.expression,
      specifier: declaration.source.value,
      valueProjections: origin.projections,
    };
  }
  if (node.type === "ImportSpecifier" && declaration !== null) {
    const importedName = canonicalValueImportedSpecifierName(node);
    return importedName === null
      ? null
      : {
          importedName,
          node: origin.expression,
          specifier: declaration.source.value,
          valueProjections: origin.projections,
        };
  }
  return null;
};

const routeFromImportDefinition = (
  origin: CanonicalValueExpressionOrigin,
  definition: Definition,
): CanonicalValueImportedRoute | null => {
  const direct = routeFromDirectImport(origin, definition);
  if (direct !== null) return direct;
  const namespaceImport = canonicalValueModuleImportFromDefinition(definition);
  return namespaceImport === null
    ? null
    : namespaceRoute({
        origin,
        specifier: namespaceImport.specifier,
        unprojectedImportedName: namespaceImport.importedName,
      });
};

const routeFromIdentifier = (
  origin: CanonicalValueExpressionOrigin,
  bindingIndex: CanonicalValueBindingIndex,
): CanonicalValueImportedRoute | null => {
  if (origin.expression.type !== "Identifier") return null;
  const binding = bindingIndex.resolveIdentifier(origin.expression);
  if (binding === null) return null;
  for (const definition of bindingIndex.definitionsOf(binding)) {
    const route = routeFromImportDefinition(origin, definition);
    if (route !== null) return route;
  }
  return null;
};

const routeFromModuleExpression = (
  origin: CanonicalValueExpressionOrigin,
  bindingIndex: CanonicalValueBindingIndex,
): CanonicalValueImportedRoute | null => {
  const moduleImport = canonicalValueModuleImportFromExpression(origin.expression, bindingIndex);
  return moduleImport === null
    ? null
    : namespaceRoute({
        origin,
        specifier: moduleImport.specifier,
        unprojectedImportedName: moduleImport.importedName,
      });
};

export const canonicalValueImportedRouteFromOrigin = (
  origin: CanonicalValueOrigin,
  bindingIndex: CanonicalValueBindingIndex,
): CanonicalValueImportedRoute | null => {
  if (origin.kind === "absent") return null;
  return (
    routeFromIdentifier(origin, bindingIndex) ?? routeFromModuleExpression(origin, bindingIndex)
  );
};

export const classifyCanonicalValueImportedRoute = ({
  route,
  ...query
}: CanonicalValueImportedRouteClassification): CanonicalValueRouteOrigin => {
  const importQuery = {
    filename: query.filename,
    importedName: route.importedName,
    repositoryRoot: query.repositoryRoot,
    specifier: route.specifier,
  };
  const entries = registeredEntriesForImportRoute(importQuery, query.catalog);
  if (entries.length !== 0) return { ...route, entries, kind: "registered" };
  const status = importRouteStatus(importQuery, query.catalog);
  return status === "unregistered"
    ? { ...route, kind: "unregistered" }
    : { ...route, kind: "external" };
};

export const canonicalValueRouteOriginKey = (origin: CanonicalValueRouteOrigin): string => {
  if (origin.kind === "local") return `local:${canonicalValueOriginKey(origin.origin)}`;
  const entryKey =
    origin.kind === "registered"
      ? origin.entries
          .map((entry) => entry.conceptId)
          .toSorted()
          .join(",")
      : "";
  const projectionKey = origin.valueProjections.map(canonicalValueOriginProjectionKey).join("|");
  return `${origin.kind}:${origin.specifier}:${origin.importedName}:${entryKey}:${projectionKey}`;
};

export const resolveCanonicalValueRouteOrigins = (query: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly catalog: CanonicalValuesCatalog;
  readonly classifyImportedRoute?: CanonicalValueImportedRouteClassifier;
  readonly filename: string;
  readonly origins: CandidateSet<CanonicalValueOrigin>;
  readonly repositoryRoot: string;
}): CandidateSet<CanonicalValueRouteOrigin> => {
  const classifyImportedRoute = query.classifyImportedRoute ?? classifyCanonicalValueImportedRoute;
  return mapCandidateSet(query.origins, {
    candidateKey: canonicalValueRouteOriginKey,
    mapCandidate: (origin) => {
      const route = canonicalValueImportedRouteFromOrigin(origin, query.bindingIndex);
      if (route !== null) {
        return classifyImportedRoute({
          bindingIndex: query.bindingIndex,
          catalog: query.catalog,
          filename: query.filename,
          repositoryRoot: query.repositoryRoot,
          route,
        });
      }
      return (
        canonicalValueUnregisteredRouteFromUnresolvedOrigin({
          bindingIndex: query.bindingIndex,
          catalog: query.catalog,
          origin,
        }) ?? { kind: "local", origin }
      );
    },
  });
};
