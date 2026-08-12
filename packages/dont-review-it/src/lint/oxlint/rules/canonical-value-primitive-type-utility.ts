import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { canonicalValueKey, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import { unwrapType } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueCallableReturnType,
  resolveCanonicalValuePrimitiveCallables,
} from "./canonical-value-primitive-type-callable.ts";
import {
  type CanonicalValuePrimitiveTypeEnvironment,
  type CanonicalValuePrimitiveTypeResolution,
  type CanonicalValuePrimitiveTypeResolver,
} from "./canonical-value-primitive-type-context.ts";
import {
  canonicalValuePrimitiveMatchesType,
  canonicalValuePrimitiveTypeRelation,
} from "./canonical-value-primitive-type-relation.ts";
import {
  canonicalValueGlobalTypeUtility,
  canonicalValueTypeReferenceSubstitution,
} from "./canonical-value-type-alias.ts";

import type { ESTree } from "@oxlint/plugins";

const substitutedType = (
  substitutions: ReadonlyMap<string, ESTree.TSType>,
  rawType: ESTree.TSType,
): ESTree.TSType => {
  const type = unwrapType(rawType);
  if (type.type !== "TSTypeReference") return type;
  const substitution = canonicalValueTypeReferenceSubstitution({ substitutions, type });
  return substitution === null ? type : substitutedType(substitutions, substitution);
};

const sameReferencePair = (input: {
  readonly check: ESTree.TSType;
  readonly pattern: ESTree.TSType;
}): boolean =>
  input.check.type === "TSTypeReference" &&
  input.pattern.type === "TSTypeReference" &&
  input.check.typeName.type === "Identifier" &&
  input.pattern.typeName.type === "Identifier" &&
  input.check.typeName.name === input.pattern.typeName.name;

const inferReferenceMembers = (
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly check: ESTree.TSTypeReference;
    readonly pattern: ESTree.TSTypeReference;
  },
): ReadonlyMap<string, ESTree.TSType> | null => {
  const checks = input.check.typeArguments?.params ?? [];
  const patterns = input.pattern.typeArguments?.params ?? [];
  if (checks.length !== patterns.length) return null;
  return checks
    .entries()
    .reduce<ReadonlyMap<string, ESTree.TSType> | null>((substitutions, [index, member]) => {
      const pattern = patterns[index];
      return substitutions === null || pattern === undefined
        ? null
        : inferSubstitutions({ ...input, check: member, pattern, substitutions });
    }, input.substitutions);
};

const inferSubstitutions = (
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly check: ESTree.TSType;
    readonly pattern: ESTree.TSType;
  },
): ReadonlyMap<string, ESTree.TSType> | null => {
  const check = substitutedType(input.substitutions, input.check);
  const pattern = unwrapType(input.pattern);
  if (pattern.type === "TSInferType") {
    return new Map(input.substitutions).set(pattern.typeParameter.name.name, check);
  }
  if (!sameReferencePair({ check, pattern })) return null;
  return inferReferenceMembers({
    ...input,
    check: check as ESTree.TSTypeReference,
    pattern: pattern as ESTree.TSTypeReference,
  });
};

export const resolveCanonicalValueConditionalTypeDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSConditionalType;
  },
): CandidateSet<CanonicalValue> | null => {
  const selected = selectedConditionalDomain(environment, input);
  return selected === null ? joinedConditionalDomain(environment, input) : selected.domain;
};

const selectedConditionalDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSConditionalType;
  },
): { readonly domain: CandidateSet<CanonicalValue> | null } | null => {
  const inferred = inferSubstitutions({
    ...input,
    check: input.type.checkType,
    pattern: input.type.extendsType,
  });
  if (inferred !== null) {
    return {
      domain: input.resolve(environment, {
        ...input,
        substitutions: inferred,
        type: input.type.trueType,
      }),
    };
  }
  const relation = canonicalValuePrimitiveTypeRelation(environment, {
    ...input,
    check: input.type.checkType,
    pattern: input.type.extendsType,
  });
  return relation === null
    ? null
    : {
        domain: input.resolve(environment, {
          ...input,
          type: relation ? input.type.trueType : input.type.falseType,
        }),
      };
};

const joinedConditionalDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSConditionalType;
  },
): CandidateSet<CanonicalValue> | null => {
  const branches = [input.type.trueType, input.type.falseType].map((type) =>
    input.resolve(environment, { ...input, type }),
  );
  const known = branches.filter(
    (branch): branch is CandidateSet<CanonicalValue> => branch !== null,
  );
  if (known.length === 0) return null;
  const joined = joinCandidateSets(known, canonicalValueKey);
  return known.length === branches.length
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueKey);
};

const joinedAwaitedDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSUnionType;
  },
): CandidateSet<CanonicalValue> | null => {
  const domains = input.type.types.map((member) =>
    awaitedDomain(environment, { ...input, type: member }),
  );
  const known = domains.filter((domain): domain is CandidateSet<CanonicalValue> => domain !== null);
  if (known.length === 0) return null;
  const joined = joinCandidateSets(known, canonicalValueKey);
  return known.length === domains.length
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueKey);
};

const awaitedPromiseArgument = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  type: ESTree.TSType,
): ESTree.TSType | undefined => {
  if (
    type.type !== "TSTypeReference" ||
    type.typeName.type !== "Identifier" ||
    !canonicalValueGlobalTypeUtility({
      identifier: type.typeName,
      names: new Set(["Promise"]),
      sourceCode: environment.sourceCode,
    })
  ) {
    return undefined;
  }
  const [argument] = type.typeArguments?.params ?? [];
  return argument;
};

const awaitedDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSType;
  },
): CandidateSet<CanonicalValue> | null => {
  const type = unwrapType(input.type);
  if (type.type === "TSUnionType") return joinedAwaitedDomain(environment, { ...input, type });
  const argument = awaitedPromiseArgument(environment, type);
  return argument === undefined
    ? input.resolve(environment, { ...input, type })
    : awaitedDomain(environment, { ...input, type: argument });
};

const unboundUtilityName = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  type: ESTree.TSTypeReference,
): string | null => {
  if (type.typeName.type !== "Identifier") return null;
  const name = type.typeName.name;
  return canonicalValueGlobalTypeUtility({
    identifier: type.typeName,
    names: new Set([name]),
    sourceCode: environment.sourceCode,
  })
    ? name
    : null;
};

const filteredUtilityDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly exclude: boolean;
    readonly filter: ESTree.TSType;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly source: ESTree.TSType;
  },
): CandidateSet<CanonicalValue> | null => {
  const candidates = input.resolve(environment, { ...input, type: input.source });
  if (candidates === null) return null;
  const matches = candidates.candidates.map((candidate) => ({
    candidate,
    matches: canonicalValuePrimitiveMatchesType(environment, {
      ...input,
      candidate,
      type: input.filter,
    }),
  }));
  const selected = matches
    .filter(({ matches: match }) => (input.exclude ? match !== true : match !== false))
    .map(({ candidate }) => candidate);
  return candidates.complete && matches.every(({ matches: match }) => match !== null)
    ? closedCandidateSet(selected, canonicalValueKey)
    : openCandidateSet(selected, canonicalValueKey);
};

const returnTypeDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly argument: ESTree.TSType;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
  },
): CandidateSet<CanonicalValue> | null => {
  const callables = resolveCanonicalValuePrimitiveCallables(environment, {
    ...input,
    type: input.argument,
  });
  if (callables === null) return null;
  const domains = callables.candidates.flatMap((callable) => {
    const type = canonicalValueCallableReturnType(callable);
    if (type === null) return [];
    const domain = input.resolve(environment, {
      ...input,
      substitutions: callable.substitutions,
      type,
    });
    return domain === null ? [] : [domain];
  });
  if (domains.length === 0) return null;
  const joined = joinCandidateSets(domains, canonicalValueKey);
  return callables.complete && domains.length === callables.candidates.length
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueKey);
};

const intrinsicString = (name: string, candidate: string): string => {
  if (name === "Lowercase") return candidate.toLowerCase();
  if (name === "Uppercase") return candidate.toUpperCase();
  const first = candidate.slice(0, 1);
  const rest = candidate.slice(1);
  return name === "Capitalize" ? `${first.toUpperCase()}${rest}` : `${first.toLowerCase()}${rest}`;
};

const intrinsicStringDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly argument: ESTree.TSType;
    readonly name: string;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
  },
): CandidateSet<CanonicalValue> | null => {
  const candidates = input.resolve(environment, { ...input, type: input.argument });
  if (candidates === null) return null;
  return flatMapCandidateSet(candidates, {
    candidateKey: canonicalValueKey,
    mapCandidate: (candidate) =>
      typeof candidate === "string"
        ? closedCandidateSet([intrinsicString(input.name, candidate)], canonicalValueKey)
        : openCandidateSet([], canonicalValueKey),
  });
};

const singleArgumentUtilityDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly argument: ESTree.TSType;
    readonly name: string;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
  },
): CandidateSet<CanonicalValue> | null => {
  if (input.name === "ReturnType") {
    return returnTypeDomain(environment, input);
  }
  if (input.name === "Awaited") {
    return awaitedDomain(environment, { ...input, type: input.argument });
  }
  if (input.name === "NonNullable") {
    const candidates = input.resolve(environment, { ...input, type: input.argument });
    if (candidates === null) return null;
    const selected = candidates.candidates.filter((candidate) => candidate !== null);
    return candidates.complete
      ? closedCandidateSet(selected, canonicalValueKey)
      : openCandidateSet(selected, canonicalValueKey);
  }
  return input.name === "Lowercase" ||
    input.name === "Uppercase" ||
    input.name === "Capitalize" ||
    input.name === "Uncapitalize"
    ? intrinsicStringDomain(environment, input)
    : null;
};

export const resolveCanonicalValueStandardUtilityDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSTypeReference;
  },
): CandidateSet<CanonicalValue> | null => {
  const name = unboundUtilityName(environment, input.type);
  if (name === null) return null;
  const [first, second] = input.type.typeArguments?.params ?? [];
  if (first === undefined) return null;
  if ((name === "Extract" || name === "Exclude") && second !== undefined) {
    return filteredUtilityDomain(environment, {
      ...input,
      exclude: name === "Exclude",
      filter: second,
      source: first,
    });
  }
  return singleArgumentUtilityDomain(environment, {
    ...input,
    argument: first,
    name,
  });
};
