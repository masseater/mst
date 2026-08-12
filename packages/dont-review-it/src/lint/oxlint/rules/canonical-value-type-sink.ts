import { flatMapCandidateSet } from "../lib/canonical-values/candidate-set.ts";
import { isFiniteVocabulary } from "../lib/canonical-values/finite-value-syntax.ts";
import { type CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import { canonicalValueDomainFactIdentity } from "./canonical-value-domain-fact.ts";
import { reportCanonicalValueDomainCandidates } from "./canonical-value-domain-report.ts";
import { type CanonicalValueDomainResolver } from "./canonical-value-domain.ts";
import { resolveCanonicalValueEnumDomain } from "./canonical-value-primitive-type-domain.ts";
import { type CanonicalValuePropertyState } from "./canonical-value-property-state.ts";
import { type CanonicalValueReporter } from "./canonical-value-report.ts";
import {
  type CanonicalValueTypeOrigin,
  type CanonicalValueTypeOriginIndex,
} from "./canonical-value-type-origin.ts";

import type { ESTree } from "@oxlint/plugins";

export type CanonicalValueTypeSinkEnvironment = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly domain: CanonicalValueDomainResolver;
  readonly filename: string;
  readonly propertyState: CanonicalValuePropertyState;
  readonly reporter: CanonicalValueReporter;
  readonly typeOrigins: CanonicalValueTypeOriginIndex;
};

const typeOriginDomain = (
  origin: CanonicalValueTypeOrigin,
  environment: CanonicalValueTypeSinkEnvironment,
) => {
  if (origin.kind === "expression") {
    return environment.domain.origin({ origin: origin.origin });
  }
  return environment.domain.imported({
    importedName: origin.importedName,
    node: origin.node,
    specifier: origin.specifier,
    valueProjections: origin.valueProjections,
  });
};

export const evaluateCanonicalValueLiteralTypeAlias = (
  node: ESTree.TSTypeAliasDeclaration,
  environment: CanonicalValueTypeSinkEnvironment,
): void => {
  const domain = environment.typeOrigins.primitiveDomain(node.typeAnnotation);
  if (domain === null || !domain.complete || !isFiniteVocabulary(domain.candidates)) return;
  environment.reporter.reportVocabulary(
    { canonicalItems: domain.candidates, node: node.typeAnnotation },
    { onlyWhenOwned: false },
  );
};

export const evaluateCanonicalValueEnum = (
  node: ESTree.TSEnumDeclaration,
  environment: CanonicalValueTypeSinkEnvironment,
): void => {
  const domain = resolveCanonicalValueEnumDomain(environment.propertyState, node);
  if (!domain.complete || !isFiniteVocabulary(domain.candidates)) return;
  environment.reporter.reportVocabulary(
    { canonicalItems: domain.candidates, node },
    { onlyWhenOwned: false },
  );
};

export const evaluateCanonicalValueIndexedAccessType = (
  node: ESTree.TSIndexedAccessType,
  environment: CanonicalValueTypeSinkEnvironment,
): void => {
  const origins = environment.typeOrigins.indexedOrigins(node);
  if (origins === null) return;
  const candidates = flatMapCandidateSet(origins, {
    candidateKey: canonicalValueDomainFactIdentity,
    mapCandidate: (origin) => typeOriginDomain(origin, environment),
  });
  reportCanonicalValueDomainCandidates({
    candidates,
    onlyWhenOwned: true,
    reportIncompleteValues: false,
    reporter: environment.reporter,
  });
};

export const evaluateCanonicalValuePropertyNameType = (
  node: ESTree.TSTypeOperator,
  environment: CanonicalValueTypeSinkEnvironment,
): void => {
  const origins = environment.typeOrigins.propertyNameOrigins(node);
  if (origins === null) return;
  const candidates = flatMapCandidateSet(origins, {
    candidateKey: canonicalValueDomainFactIdentity,
    mapCandidate: environment.domain.propertyNames,
  });
  reportCanonicalValueDomainCandidates({
    candidates,
    onlyWhenOwned: false,
    reportIncompleteValues: false,
    reporter: environment.reporter,
  });
};
