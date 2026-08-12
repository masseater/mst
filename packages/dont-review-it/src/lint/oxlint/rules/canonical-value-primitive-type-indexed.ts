import {
  joinCandidateSets,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { canonicalValueKey, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import { unwrapType } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValuePropertyKeyOf } from "./canonical-value-binding-index.ts";
import {
  canonicalValueCallableParameterType,
  resolveCanonicalValuePrimitiveCallables,
} from "./canonical-value-primitive-type-callable.ts";
import {
  type CanonicalValuePrimitiveTypeEnvironment,
  type CanonicalValuePrimitiveTypeResolution,
  type CanonicalValuePrimitiveTypeResolver,
} from "./canonical-value-primitive-type-context.ts";
import { resolveCanonicalValuePrimitiveTypeReference } from "./canonical-value-primitive-type-reference.ts";
import { canonicalValueGlobalTypeUtility } from "./canonical-value-type-alias.ts";

import type { ESTree } from "@oxlint/plugins";

const isGlobalParameters = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  type: ESTree.TSTypeReference,
): boolean =>
  type.typeName.type === "Identifier" &&
  type.typeName.name === "Parameters" &&
  canonicalValueGlobalTypeUtility({
    identifier: type.typeName,
    names: new Set(["Parameters"]),
    sourceCode: environment.sourceCode,
  });

const parametersCallableType = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  type: ESTree.TSType,
): ESTree.TSType | null => {
  const reference = unwrapType(type);
  if (reference.type !== "TSTypeReference" || !isGlobalParameters(environment, reference)) {
    return null;
  }
  const [callable] = reference.typeArguments?.params ?? [];
  return callable ?? null;
};

const parametersIndexedDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly index: number;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSIndexedAccessType;
  },
): CandidateSet<CanonicalValue> | null => {
  const callableType = parametersCallableType(environment, input.type.objectType);
  if (callableType === null) return null;
  const callables = resolveCanonicalValuePrimitiveCallables(environment, {
    ...input,
    type: callableType,
  });
  if (callables === null) return null;
  const domains = callables.candidates.flatMap((callable) => {
    const type = canonicalValueCallableParameterType(callable, input.index);
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

const staticTypePropertyName = (member: ESTree.TSSignature): string | null => {
  if (member.type !== "TSPropertySignature") return null;
  const propertyKey = canonicalValuePropertyKeyOf(member.key, member.computed);
  return propertyKey.kind === "static" ? propertyKey.value : null;
};

const signaturePropertyDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly members: readonly ESTree.TSSignature[];
    readonly name: string;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
  },
): CandidateSet<CanonicalValue> | null => {
  const matching = input.members.filter((member) => staticTypePropertyName(member) === input.name);
  const domains = matching.flatMap((member) => {
    if (member.type !== "TSPropertySignature" || member.typeAnnotation === null) return [];
    const domain = input.resolve(environment, {
      ...input,
      type: member.typeAnnotation.typeAnnotation,
    });
    return domain === null ? [] : [domain];
  });
  if (domains.length === 0) return null;
  const joined = joinCandidateSets(domains, canonicalValueKey);
  const complete =
    domains.length === matching.length &&
    input.members.every(
      (member) => member.type === "TSPropertySignature" && staticTypePropertyName(member) !== null,
    );
  return complete ? joined : openCandidateSet(joined.candidates, canonicalValueKey);
};

const typeLiteralPropertyDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly name: string;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSTypeLiteral;
  },
): CandidateSet<CanonicalValue> | null =>
  signaturePropertyDomain(environment, { ...input, members: input.type.members });

const interfacePropertyDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly declarations: readonly ESTree.TSInterfaceDeclaration[];
    readonly name: string;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
  },
): CandidateSet<CanonicalValue> | null => {
  const domains = input.declarations.flatMap((declaration) => {
    const domain = signaturePropertyDomain(environment, {
      ...input,
      members: declaration.body.body,
    });
    return domain === null ? [] : [domain];
  });
  if (domains.length === 0) return null;
  return joinCandidateSets(domains, canonicalValueKey);
};

const referencedObjectPropertyDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly name: string;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSTypeReference;
  },
): CandidateSet<CanonicalValue> | null => {
  const referenced = resolveCanonicalValuePrimitiveTypeReference(environment, input);
  if (referenced !== null) {
    return objectPropertyDomain(environment, { ...input, ...referenced });
  }
  if (input.type.typeName.type !== "Identifier") return null;
  const binding = environment.bindingIndex.resolveIdentifier(input.type.typeName);
  if (binding === null) return null;
  const declarations = environment.bindingIndex
    .definitionsOf(binding)
    .flatMap((definition) =>
      definition.node.type === "TSInterfaceDeclaration" ? [definition.node] : [],
    );
  return declarations.length === 0
    ? null
    : interfacePropertyDomain(environment, { ...input, declarations });
};

const objectPropertyDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly name: string;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSType;
  },
): CandidateSet<CanonicalValue> | null => {
  const type = unwrapType(input.type);
  if (type.type === "TSTypeLiteral") {
    return typeLiteralPropertyDomain(environment, { ...input, type });
  }
  return type.type === "TSTypeReference"
    ? referencedObjectPropertyDomain(environment, { ...input, type })
    : null;
};

const indexedCandidateDomain = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly candidate: CanonicalValue;
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSIndexedAccessType;
  },
): CandidateSet<CanonicalValue> | null => {
  if (typeof input.candidate === "number" && Number.isInteger(input.candidate)) {
    const parameterDomain = parametersIndexedDomain(environment, {
      ...input,
      index: input.candidate,
    });
    if (parameterDomain !== null) return parameterDomain;
  }
  return objectPropertyDomain(environment, {
    ...input,
    name: String(input.candidate),
    type: input.type.objectType,
  });
};

const mappedType = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & { readonly type: ESTree.TSType },
): {
  readonly substitutions: ReadonlyMap<string, ESTree.TSType>;
  readonly type: ESTree.TSMappedType;
} | null => {
  const type = unwrapType(input.type);
  if (type.type === "TSMappedType") return { substitutions: input.substitutions, type };
  if (type.type !== "TSTypeReference") return null;
  const referenced = resolveCanonicalValuePrimitiveTypeReference(environment, {
    ...input,
    type,
  });
  return referenced === null ? null : mappedType(environment, referenced);
};

export const resolveCanonicalValuePrimitiveIndexedType = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSIndexedAccessType;
  },
): CandidateSet<CanonicalValue> | null => {
  const indices = input.resolve(environment, { ...input, type: input.type.indexType });
  if (indices === null) return null;
  const domains = indices.candidates.flatMap((candidate) => {
    const domain = indexedCandidateDomain(environment, { ...input, candidate });
    return domain === null ? [] : [domain];
  });
  if (domains.length === 0) return null;
  const joined = joinCandidateSets(domains, canonicalValueKey);
  return indices.complete && domains.length === indices.candidates.length
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueKey);
};

export const resolveCanonicalValuePrimitiveMappedKey = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & {
    readonly resolve: CanonicalValuePrimitiveTypeResolver;
    readonly type: ESTree.TSTypeOperator;
  },
): CandidateSet<CanonicalValue> | null => {
  if (input.type.operator !== "keyof") return null;
  const mapped = mappedType(environment, { ...input, type: input.type.typeAnnotation });
  if (mapped === null) return null;
  const keys = input.resolve(environment, {
    ...input,
    substitutions: mapped.substitutions,
    type: mapped.type.constraint,
  });
  if (keys === null) return null;
  return mapped.type.nameType === null
    ? keys
    : openCandidateSet(keys.candidates, canonicalValueKey);
};
