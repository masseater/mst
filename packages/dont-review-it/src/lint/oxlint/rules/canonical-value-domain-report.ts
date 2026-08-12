import { canonicalValueKey } from "../lib/canonical-values/fingerprint.ts";
import { isFiniteVocabulary } from "../lib/canonical-values/finite-value-syntax.ts";

import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type { CanonicalValueDomainFact } from "./canonical-value-domain-fact.ts";
import type { CanonicalValueReporter } from "./canonical-value-report.ts";

type CanonicalValueDomainReportInput = {
  readonly candidates: CandidateSet<CanonicalValueDomainFact>;
  readonly onlyWhenOwned: boolean;
  readonly reportDerivedSingletonValues?: boolean;
  readonly reportIncompleteValues: boolean;
  readonly reporter: CanonicalValueReporter;
  readonly supplemental?: boolean;
};

const reportUnregisteredRoutes = (input: CanonicalValueDomainReportInput): void => {
  for (const candidate of input.candidates.candidates) {
    if (candidate.kind !== "unregistered") continue;
    input.reporter.reportImportRoute({
      importedName: candidate.importedName,
      node: candidate.node,
      specifier: candidate.specifier,
    });
  }
};

const reportValueCandidates = (input: CanonicalValueDomainReportInput): void => {
  for (const candidate of input.candidates.candidates) {
    if (candidate.kind !== "values" || !candidate.localContribution) continue;
    const derivedSingleton =
      input.reportDerivedSingletonValues === true &&
      candidate.derivedFromRegisteredRoute &&
      new Set(candidate.values.map(canonicalValueKey)).size === 1;
    if (!isFiniteVocabulary(candidate.values) && !derivedSingleton) continue;
    input.reporter.reportVocabulary(
      { canonicalItems: candidate.values, node: candidate.node },
      {
        onlyWhenOwned: input.onlyWhenOwned && !candidate.derivedFromRegisteredRoute,
        ...(input.supplemental === true ? { supplemental: true } : {}),
      },
    );
  }
};

export const reportCanonicalValueDomainCandidates = (
  input: CanonicalValueDomainReportInput,
): void => {
  reportUnregisteredRoutes(input);
  if (!input.candidates.complete && !input.reportIncompleteValues) return;
  reportValueCandidates(input);
};
