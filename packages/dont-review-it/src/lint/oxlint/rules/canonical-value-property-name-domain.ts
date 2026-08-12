import { uniqBy } from "es-toolkit";

import {
  appendCandidateSets,
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { canonicalValueKey } from "../lib/canonical-values/fingerprint.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";
import {
  type CanonicalValuePropertyNameOrigin,
  type CanonicalValuePropertyNameStructure,
} from "./canonical-value-property-name-origin.ts";
import {
  appendCanonicalValuePropertyNameFragments,
  canonicalValuePropertyNameFragmentKey,
  resolveCanonicalValueObjectPropertyNameFragments,
  resolveCanonicalValuePropertyNameStructureFragments,
  type CanonicalValuePropertyNameFragment,
  type CanonicalValuePropertyNameResolution,
} from "./canonical-value-property-name-structure.ts";
import { type CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import { type CanonicalValuePropertyState } from "./canonical-value-property-state.ts";
import {
  classifyCanonicalValueImportedRoute,
  canonicalValueRouteOriginKey,
  resolveCanonicalValueRouteOrigins,
  type CanonicalValueImportedRouteClassifier,
  type CanonicalValueRouteOrigin,
} from "./canonical-value-route-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValuesCatalog } from "../lib/canonical-values/catalog.ts";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";

export type CanonicalValuePropertyNameEnvironment = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly catalog: CanonicalValuesCatalog;
  readonly classifyImportedRoute?: CanonicalValueImportedRouteClassifier;
  readonly filename: string;
  readonly propertyState: CanonicalValuePropertyState;
  readonly repositoryRoot: string;
};

const routeFragments = (
  route: Exclude<CanonicalValueRouteOrigin, { readonly kind: "local" }>,
): CandidateSet<CanonicalValuePropertyNameFragment> => {
  const fragment = { node: route.node, routes: [route], values: [] };
  return route.kind === "registered"
    ? closedCandidateSet([fragment], canonicalValuePropertyNameFragmentKey)
    : openCandidateSet([fragment], canonicalValuePropertyNameFragmentKey);
};

const structuresFragments = (
  resolution: CanonicalValuePropertyNameResolution,
  structures: readonly CanonicalValuePropertyNameStructure[],
): CandidateSet<CanonicalValuePropertyNameFragment> => {
  const [first, ...remaining] = structures;
  if (first === undefined) return unknownCandidateSet();
  return remaining.reduce(
    (fragments, structure) =>
      appendCanonicalValuePropertyNameFragments(
        fragments,
        resolveCanonicalValuePropertyNameStructureFragments(resolution, structure),
      ),
    resolveCanonicalValuePropertyNameStructureFragments(resolution, first),
  );
};

const classifiedImportRoute = (
  environment: CanonicalValuePropertyNameEnvironment,
  origin: Extract<CanonicalValuePropertyNameOrigin, { readonly kind: "import" }>,
): Exclude<CanonicalValueRouteOrigin, { readonly kind: "local" }> => {
  const classify = environment.classifyImportedRoute ?? classifyCanonicalValueImportedRoute;
  return classify({
    bindingIndex: environment.bindingIndex,
    catalog: environment.catalog,
    filename: environment.filename,
    repositoryRoot: environment.repositoryRoot,
    route: {
      importedName: origin.importedName,
      node: origin.node,
      specifier: origin.specifier,
      valueProjections: origin.valueProjections,
    },
  }) as Exclude<CanonicalValueRouteOrigin, { readonly kind: "local" }>;
};

const localOriginFragments = (
  resolution: CanonicalValuePropertyNameResolution,
  origin: CanonicalValueOrigin,
): CandidateSet<CanonicalValuePropertyNameFragment> => {
  if (origin.kind === "absent" || origin.projections.length !== 0) return unknownCandidateSet();
  const expression = unwrapExpression(origin.expression);
  if (resolution.seenExpressions.has(expression)) return unknownCandidateSet();
  const next = {
    ...resolution,
    seenExpressions: new Set([...resolution.seenExpressions, expression]),
  };
  if (expression.type === "ObjectExpression") {
    return resolveCanonicalValueObjectPropertyNameFragments({
      object: expression,
      resolution: next,
      resolveExpression: expressionFragments,
    });
  }
  if (expression.type === "ClassExpression" || expression.type === "ClassDeclaration") {
    return resolveCanonicalValuePropertyNameStructureFragments(next, {
      kind: "class",
      node: expression,
      side: "static",
    });
  }
  return expressionFragments(next, expression);
};

const fragmentsFromRoute = (
  resolution: CanonicalValuePropertyNameResolution,
  route: CanonicalValueRouteOrigin,
): CandidateSet<CanonicalValuePropertyNameFragment> =>
  route.kind === "local" ? localOriginFragments(resolution, route.origin) : routeFragments(route);

const originSetFragments = (
  resolution: CanonicalValuePropertyNameResolution,
  origins: CandidateSet<CanonicalValueOrigin>,
): CandidateSet<CanonicalValuePropertyNameFragment> =>
  flatMapCandidateSet(resolveCanonicalValueRouteOrigins({ ...resolution.environment, origins }), {
    candidateKey: canonicalValuePropertyNameFragmentKey,
    mapCandidate: (route) => fragmentsFromRoute(resolution, route),
  });

const expressionFragments = (
  resolution: CanonicalValuePropertyNameResolution,
  expression: ESTree.Expression,
): CandidateSet<CanonicalValuePropertyNameFragment> =>
  originSetFragments(resolution, resolution.environment.propertyState.origins({ expression }));

const intersectFragments = (
  left: CanonicalValuePropertyNameFragment,
  right: CanonicalValuePropertyNameFragment,
): CanonicalValuePropertyNameFragment => {
  const rightValues = new Set(right.values.map(canonicalValueKey));
  return {
    node: left.node,
    routes: uniqBy([...left.routes, ...right.routes], canonicalValueRouteOriginKey),
    values: left.values.filter((value) => rightValues.has(canonicalValueKey(value))),
  };
};

const appendCompositeFragment = (
  operator: "intersection" | "union",
): ((
  left: CanonicalValuePropertyNameFragment,
  right: CanonicalValuePropertyNameFragment,
) => CanonicalValuePropertyNameFragment) =>
  operator === "intersection"
    ? (left, right) => ({
        node: left.node,
        routes: uniqBy([...left.routes, ...right.routes], canonicalValueRouteOriginKey),
        values: [...left.values, ...right.values],
      })
    : intersectFragments;

const compositeFragments = (
  resolution: CanonicalValuePropertyNameResolution,
  origin: Extract<CanonicalValuePropertyNameOrigin, { readonly kind: "composite" }>,
): CandidateSet<CanonicalValuePropertyNameFragment> => {
  const [first, ...remaining] = origin.origins;
  if (first === undefined) return unknownCandidateSet();
  const combined = remaining.reduce(
    (fragments, member) =>
      appendCandidateSets({
        accumulated: fragments,
        append: appendCompositeFragment(origin.operator),
        candidateKey: canonicalValuePropertyNameFragmentKey,
        next: propertyNameOriginFragments(resolution, member),
      }),
    propertyNameOriginFragments(resolution, first),
  );
  return mapCandidateSet(combined, {
    candidateKey: canonicalValuePropertyNameFragmentKey,
    mapCandidate: (fragment) => ({ ...fragment, node: origin.node }),
  });
};

const propertyNameOriginFragments = (
  resolution: CanonicalValuePropertyNameResolution,
  origin: CanonicalValuePropertyNameOrigin,
): CandidateSet<CanonicalValuePropertyNameFragment> => {
  if (origin.kind === "composite") return compositeFragments(resolution, origin);
  if (origin.kind === "import") {
    return routeFragments(classifiedImportRoute(resolution.environment, origin));
  }
  if (origin.kind === "structures") {
    return structuresFragments(resolution, origin.structures);
  }
  return fragmentsFromRoute(resolution, { kind: "local", origin: origin.origin });
};

const factsFromFragments = (
  fragments: CandidateSet<CanonicalValuePropertyNameFragment>,
): CandidateSet<CanonicalValueDomainFact> => {
  const facts = fragments.candidates.flatMap((fragment) => [
    ...fragment.routes,
    ...(fragment.values.length === 0
      ? []
      : [
          {
            derivedFromRegisteredRoute: fragment.routes.some(
              (route) => route.kind === "registered",
            ),
            kind: "values" as const,
            localContribution: true,
            node: fragment.node,
            values: fragment.values,
          },
        ]),
  ]);
  return fragments.complete
    ? closedCandidateSet(facts, canonicalValueDomainFactIdentity)
    : openCandidateSet(facts, canonicalValueDomainFactIdentity);
};

const resolutionFor = (
  environment: CanonicalValuePropertyNameEnvironment,
  keySemantics: CanonicalValuePropertyNameResolution["keySemantics"],
): CanonicalValuePropertyNameResolution => ({
  environment,
  keySemantics,
  seenExpressions: new Set(),
});

export const resolveCanonicalValuePropertyNameDomain = (
  environment: CanonicalValuePropertyNameEnvironment,
  origin: CanonicalValuePropertyNameOrigin,
): CandidateSet<CanonicalValueDomainFact> =>
  factsFromFragments(propertyNameOriginFragments(resolutionFor(environment, "keyof"), origin));

export const resolveCanonicalValuePropertyNameOriginsDomain = (
  environment: CanonicalValuePropertyNameEnvironment,
  input: {
    readonly keySemantics: CanonicalValuePropertyNameResolution["keySemantics"];
    readonly origins: CandidateSet<CanonicalValueOrigin>;
  },
): CandidateSet<CanonicalValueDomainFact> =>
  factsFromFragments(
    originSetFragments(resolutionFor(environment, input.keySemantics), input.origins),
  );
