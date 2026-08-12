import {
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
  type CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";

import type { ESTree } from "@oxlint/plugins";

export type CanonicalValuePropertyNameStructure =
  | { readonly kind: "class"; readonly node: ESTree.Class; readonly side: "instance" | "static" }
  | { readonly kind: "enum"; readonly node: ESTree.TSEnumDeclaration }
  | { readonly kind: "interface"; readonly node: ESTree.TSInterfaceDeclaration }
  | { readonly kind: "namespace"; readonly node: ESTree.TSModuleDeclaration }
  | { readonly kind: "type-literal"; readonly node: ESTree.TSTypeLiteral };

export type CanonicalValuePropertyNameOrigin =
  | {
      readonly kind: "composite";
      readonly node: ESTree.TSType;
      readonly operator: "intersection" | "union";
      readonly origins: readonly CanonicalValuePropertyNameOrigin[];
    }
  | {
      readonly importedName: string;
      readonly kind: "import";
      readonly node: ESTree.Span;
      readonly specifier: string;
      readonly valueProjections: readonly CanonicalValueOriginProjection[];
    }
  | { readonly kind: "expression"; readonly origin: CanonicalValueOrigin }
  | {
      readonly kind: "structures";
      readonly structures: readonly CanonicalValuePropertyNameStructure[];
    };

export const canonicalValuePropertyNameOriginKey = (
  origin: CanonicalValuePropertyNameOrigin,
): string => {
  if (origin.kind === "expression") return `expression:${canonicalValueOriginKey(origin.origin)}`;
  if (origin.kind === "composite") {
    return `${origin.operator}:${origin.origins.map(canonicalValuePropertyNameOriginKey).join("|")}`;
  }
  if (origin.kind === "import") {
    return `import:${origin.specifier}:${origin.importedName}:${origin.valueProjections.length}`;
  }
  return `structures:${origin.structures
    .map((structure) => `${structure.kind}:${structure.node.start}:${structure.node.end}`)
    .join("|")}`;
};

const propertyNameOriginBundleKey = (
  origins: readonly CanonicalValuePropertyNameOrigin[],
): string => origins.map(canonicalValuePropertyNameOriginKey).join("|");

export const combineCanonicalValuePropertyNameOriginSets = (
  members: readonly CandidateSet<CanonicalValuePropertyNameOrigin>[],
  input: {
    readonly node: ESTree.TSType;
    readonly operator: "intersection" | "union";
  },
): CandidateSet<CanonicalValuePropertyNameOrigin> => {
  const bundles = members.reduce<CandidateSet<readonly CanonicalValuePropertyNameOrigin[]>>(
    (accumulated, member) =>
      flatMapCandidateSet(accumulated, {
        candidateKey: propertyNameOriginBundleKey,
        mapCandidate: (bundle) =>
          mapCandidateSet(member, {
            candidateKey: propertyNameOriginBundleKey,
            mapCandidate: (origin) => [...bundle, origin],
          }),
      }),
    closedCandidateSet([[]], propertyNameOriginBundleKey),
  );
  return mapCandidateSet(bundles, {
    candidateKey: canonicalValuePropertyNameOriginKey,
    mapCandidate: (origins) => ({
      kind: "composite",
      node: input.node,
      operator: input.operator,
      origins,
    }),
  });
};
