import {
  absentCandidateSet,
  closedCandidateSet,
  filterCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { canonicalValueKey, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import { scalarLiteralValue, unwrapType } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  type CanonicalValuePrimitiveTypeEnvironment as PrimitiveTypeEnvironment,
  type CanonicalValuePrimitiveTypeResolution as PrimitiveTypeResolution,
} from "./canonical-value-primitive-type-context.ts";
import {
  resolveCanonicalValuePrimitiveIndexedType,
  resolveCanonicalValuePrimitiveMappedKey,
} from "./canonical-value-primitive-type-indexed.ts";
import { resolveCanonicalValuePrimitiveTypeReference } from "./canonical-value-primitive-type-reference.ts";
import {
  resolveCanonicalValueConditionalTypeDomain,
  resolveCanonicalValueStandardUtilityDomain,
} from "./canonical-value-primitive-type-utility.ts";
import { type CanonicalValueTypeAliasIndex } from "./canonical-value-type-alias.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

const literalTypeDomain = (type: ESTree.TSLiteralType): CandidateSet<CanonicalValue> | null => {
  const spelling = scalarLiteralValue(type.literal);
  return spelling === undefined ? null : closedCandidateSet([spelling], canonicalValueKey);
};

const unionTypeDomain = (
  environment: PrimitiveTypeEnvironment,
  input: PrimitiveTypeResolution & { readonly type: ESTree.TSUnionType },
): CandidateSet<CanonicalValue> | null => {
  const members = input.type.types.map((type) =>
    resolvePrimitiveType(environment, { ...input, type }),
  );
  const known = members.filter((member): member is CandidateSet<CanonicalValue> => member !== null);
  if (known.length === 0) return null;
  const joined = joinCandidateSets(known, canonicalValueKey);
  return known.length === members.length
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueKey);
};

const templateTypeDomain = (
  environment: PrimitiveTypeEnvironment,
  input: PrimitiveTypeResolution & { readonly type: ESTree.TSTemplateLiteralType },
): CandidateSet<CanonicalValue> | null => {
  const initial = closedCandidateSet<CanonicalValue>(
    [input.type.quasis[0]?.value.cooked ?? input.type.quasis[0]?.value.raw ?? ""],
    canonicalValueKey,
  );
  return input.type.types
    .entries()
    .reduce<CandidateSet<CanonicalValue> | null>((spellings, [index, substitution]) => {
      if (spellings === null) return null;
      const candidates = resolvePrimitiveType(environment, { ...input, type: substitution });
      if (candidates === null) return null;
      const suffix = input.type.quasis[index + 1];
      return flatMapCandidateSet(spellings, {
        candidateKey: canonicalValueKey,
        mapCandidate: (prefix) =>
          flatMapCandidateSet(candidates, {
            candidateKey: canonicalValueKey,
            mapCandidate: (candidate) =>
              closedCandidateSet(
                [
                  `${String(prefix)}${String(candidate)}${suffix?.value.cooked ?? suffix?.value.raw ?? ""}`,
                ],
                canonicalValueKey,
              ),
          }),
      });
    }, initial);
};

const primitiveConstraint = (
  type: ESTree.TSType,
): ((candidate: CanonicalValue) => boolean) | null => {
  if (type.type === "TSStringKeyword") return (candidate) => typeof candidate === "string";
  if (type.type === "TSNumberKeyword") return (candidate) => typeof candidate === "number";
  if (type.type === "TSBooleanKeyword") return (candidate) => typeof candidate === "boolean";
  return type.type === "TSUnknownKeyword" ? () => true : null;
};

const intersectDomains = (
  domains: readonly CandidateSet<CanonicalValue>[],
): CandidateSet<CanonicalValue> => {
  const [first, ...remaining] = domains;
  if (first === undefined) return absentCandidateSet();
  return remaining.reduce((intersection, domain) => {
    const keys = new Set(domain.candidates.map(canonicalValueKey));
    const filtered = filterCandidateSet(intersection, (candidate) =>
      keys.has(canonicalValueKey(candidate)),
    );
    return intersection.complete && domain.complete
      ? filtered
      : openCandidateSet(filtered.candidates, canonicalValueKey);
  }, first);
};

const intersectionTypeDomain = (
  environment: PrimitiveTypeEnvironment,
  input: PrimitiveTypeResolution & { readonly type: ESTree.TSIntersectionType },
): CandidateSet<CanonicalValue> | null => {
  const members = input.type.types.map((type) => ({
    constraint: primitiveConstraint(unwrapType(type)),
    domain: resolvePrimitiveType(environment, { ...input, type }),
  }));
  const domains = members
    .map((member) => member.domain)
    .filter((domain): domain is CandidateSet<CanonicalValue> => domain !== null);
  if (domains.length === 0) return null;
  const constrained = members.reduce(
    (domain, member) =>
      member.constraint === null ? domain : filterCandidateSet(domain, member.constraint),
    intersectDomains(domains),
  );
  const complete = members.every(
    (member) => member.constraint !== null || member.domain?.complete === true,
  );
  return complete ? constrained : openCandidateSet(constrained.candidates, canonicalValueKey);
};

const referenceTypeDomain = (
  environment: PrimitiveTypeEnvironment,
  input: PrimitiveTypeResolution & { readonly type: ESTree.TSTypeReference },
): CandidateSet<CanonicalValue> | null => {
  const referenced = resolveCanonicalValuePrimitiveTypeReference(environment, input);
  return referenced === null
    ? resolveCanonicalValueStandardUtilityDomain(environment, {
        ...input,
        resolve: resolvePrimitiveType,
      })
    : resolvePrimitiveType(environment, referenced);
};

const directPrimitiveLeaf = (
  environment: PrimitiveTypeEnvironment,
  input: PrimitiveTypeResolution,
): CandidateSet<CanonicalValue> | null => {
  const type = input.type;
  if (type.type === "TSLiteralType") return literalTypeDomain(type);
  if (type.type === "TSNullKeyword") return closedCandidateSet([null], canonicalValueKey);
  if (type.type === "TSNeverKeyword") return absentCandidateSet();
  if (type.type === "TSUnionType") return unionTypeDomain(environment, { ...input, type });
  return null;
};

const compositePrimitiveType = (
  environment: PrimitiveTypeEnvironment,
  input: PrimitiveTypeResolution,
): CandidateSet<CanonicalValue> | null => {
  const type = input.type;
  if (type.type === "TSIntersectionType") {
    return intersectionTypeDomain(environment, { ...input, type });
  }
  if (type.type === "TSConditionalType") {
    return resolveCanonicalValueConditionalTypeDomain(environment, {
      ...input,
      resolve: resolvePrimitiveType,
      type,
    });
  }
  return type.type === "TSTemplateLiteralType"
    ? templateTypeDomain(environment, { ...input, type })
    : null;
};

const structuralPrimitiveType = (
  environment: PrimitiveTypeEnvironment,
  input: PrimitiveTypeResolution,
): CandidateSet<CanonicalValue> | null => {
  const type = input.type;
  if (type.type === "TSIndexedAccessType") {
    return resolveCanonicalValuePrimitiveIndexedType(environment, {
      ...input,
      resolve: resolvePrimitiveType,
      type,
    });
  }
  if (type.type === "TSTypeOperator") {
    return resolveCanonicalValuePrimitiveMappedKey(environment, {
      ...input,
      resolve: resolvePrimitiveType,
      type,
    });
  }
  return type.type === "TSTypeReference"
    ? referenceTypeDomain(environment, { ...input, type })
    : null;
};

const directPrimitiveType = (
  environment: PrimitiveTypeEnvironment,
  input: PrimitiveTypeResolution,
): CandidateSet<CanonicalValue> | null =>
  directPrimitiveLeaf(environment, input) ??
  compositePrimitiveType(environment, input) ??
  structuralPrimitiveType(environment, input);

const resolvePrimitiveType = (
  environment: PrimitiveTypeEnvironment,
  rawInput: PrimitiveTypeResolution,
): CandidateSet<CanonicalValue> | null => {
  const type = unwrapType(rawInput.type);
  if (rawInput.seenTypes.has(type)) return null;
  return directPrimitiveType(environment, {
    ...rawInput,
    seenTypes: new Set([...rawInput.seenTypes, type]),
    type,
  });
};

export const resolveCanonicalValuePrimitiveTypeDomain = (input: {
  readonly aliases: CanonicalValueTypeAliasIndex;
  readonly bindingIndex: PrimitiveTypeEnvironment["bindingIndex"];
  readonly sourceCode: Pick<SourceCode, "getScope">;
  readonly type: ESTree.TSType;
}): CandidateSet<CanonicalValue> | null =>
  resolvePrimitiveType(
    {
      aliases: input.aliases,
      bindingIndex: input.bindingIndex,
      sourceCode: input.sourceCode,
    },
    { seenTypes: new Set(), substitutions: new Map(), type: input.type },
  );

const canonicalEnumInitializerDomain = (
  propertyState: CanonicalValuePropertyState,
  initializer: ESTree.Expression,
): CandidateSet<CanonicalValue> => {
  const primitives = propertyState.primitives({ expression: initializer });
  const candidates = primitives.candidates.filter(
    (primitive): primitive is CanonicalValue =>
      primitive !== undefined && typeof primitive !== "bigint",
  );
  return primitives.complete && candidates.length === primitives.candidates.length
    ? closedCandidateSet(candidates, canonicalValueKey)
    : openCandidateSet(candidates, canonicalValueKey);
};

const automaticEnumMemberDomain = (
  previous: CandidateSet<CanonicalValue> | null,
): CandidateSet<CanonicalValue> => {
  if (previous === null) return closedCandidateSet([0], canonicalValueKey);
  return flatMapCandidateSet(previous, {
    candidateKey: canonicalValueKey,
    mapCandidate: (candidate) =>
      typeof candidate === "number"
        ? closedCandidateSet([candidate + 1], canonicalValueKey)
        : openCandidateSet([], canonicalValueKey),
  });
};

export const resolveCanonicalValueEnumDomain = (
  propertyState: CanonicalValuePropertyState,
  node: ESTree.TSEnumDeclaration,
): CandidateSet<CanonicalValue> =>
  node.body.members.reduce<{
    readonly domain: CandidateSet<CanonicalValue>;
    readonly previous: CandidateSet<CanonicalValue> | null;
  }>(
    (state, member) => {
      const current: CandidateSet<CanonicalValue> =
        member.initializer === null
          ? automaticEnumMemberDomain(state.previous)
          : canonicalEnumInitializerDomain(propertyState, member.initializer);
      return {
        domain: joinCandidateSets([state.domain, current], canonicalValueKey),
        previous: current,
      };
    },
    { domain: absentCandidateSet<CanonicalValue>(), previous: null },
  ).domain;
