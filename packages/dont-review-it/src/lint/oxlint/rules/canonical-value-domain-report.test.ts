import { describe, expect, test, vi } from "vite-plus/test";

import { closedCandidateSet, openCandidateSet } from "../lib/canonical-values/candidate-set.ts";
import { EMPTY_CANONICAL_VALUES_CATALOG } from "../lib/canonical-values/catalog.ts";
import {
  canonicalValueDomainFactIdentity,
  type CanonicalValueDomainFact,
} from "./canonical-value-domain-fact.ts";
import { reportCanonicalValueDomainCandidates } from "./canonical-value-domain-report.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import type { CanonicalValueReporter } from "./canonical-value-report.ts";

const ARRAY_NODE: ESTree.ArrayExpression = {
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

const reporterFixture = () => {
  const reportImportRoute = vi.fn<CanonicalValueReporter["reportImportRoute"]>();
  const reportVocabulary = vi.fn<CanonicalValueReporter["reportVocabulary"]>();
  return {
    reportImportRoute,
    reportVocabulary,
    reporter: {
      catalog: EMPTY_CANONICAL_VALUES_CATALOG,
      reportImportRoute,
      reportVocabulary,
      repositoryRoot: "/repo",
    } satisfies CanonicalValueReporter,
  };
};

const localVocabularyFact = (
  canonicalItems: readonly CanonicalValue[],
  options: {
    readonly derivedFromRegisteredRoute?: boolean;
    readonly localContribution?: boolean;
  } = {},
): CanonicalValueDomainFact => ({
  derivedFromRegisteredRoute: options.derivedFromRegisteredRoute ?? false,
  kind: "values",
  localContribution: options.localContribution ?? true,
  node: ARRAY_NODE,
  values: canonicalItems,
});

const UNREGISTERED_ROUTE = {
  importedName: "ORDER_STATUSES",
  kind: "unregistered",
  node: ARRAY_NODE,
  specifier: "@mst/order-vocabulary/shadow",
  valueProjections: [],
} satisfies CanonicalValueDomainFact;

describe("canonical value domain reporting", () => {
  test("an unregistered route is reported even when the candidate set is incomplete", () => {
    const fixture = reporterFixture();
    const candidates = openCandidateSet(
      [UNREGISTERED_ROUTE, localVocabularyFact(["draft", "published"])],
      canonicalValueDomainFactIdentity,
    );

    reportCanonicalValueDomainCandidates({
      candidates,
      onlyWhenOwned: false,
      reportIncompleteValues: false,
      reporter: fixture.reporter,
    });

    expect(fixture.reportImportRoute).toHaveBeenCalledWith({
      importedName: "ORDER_STATUSES",
      node: ARRAY_NODE,
      specifier: "@mst/order-vocabulary/shadow",
    });
    expect(fixture.reportVocabulary).not.toHaveBeenCalled();
  });

  test("a certain sink reports a known value candidate from an incomplete source", () => {
    const fixture = reporterFixture();
    const candidates = openCandidateSet(
      [localVocabularyFact(["draft", "published"])],
      canonicalValueDomainFactIdentity,
    );

    reportCanonicalValueDomainCandidates({
      candidates,
      onlyWhenOwned: false,
      reportIncompleteValues: true,
      reporter: fixture.reporter,
    });

    expect(fixture.reportVocabulary).toHaveBeenCalledWith(
      { canonicalItems: ["draft", "published"], node: ARRAY_NODE },
      { onlyWhenOwned: false },
    );
  });

  test("a complete finite local vocabulary keeps the owned-only policy", () => {
    const fixture = reporterFixture();
    const candidates = closedCandidateSet(
      [localVocabularyFact(["draft", "published"])],
      canonicalValueDomainFactIdentity,
    );

    reportCanonicalValueDomainCandidates({
      candidates,
      onlyWhenOwned: true,
      reportIncompleteValues: false,
      reporter: fixture.reporter,
    });

    expect(fixture.reportVocabulary).toHaveBeenCalledWith(
      { canonicalItems: ["draft", "published"], node: ARRAY_NODE },
      { onlyWhenOwned: true },
    );
  });

  test("a registered contribution makes an enlarged local vocabulary unconditional", () => {
    const fixture = reporterFixture();
    const candidates = closedCandidateSet(
      [
        localVocabularyFact(["draft", "published", "archived"], {
          derivedFromRegisteredRoute: true,
        }),
      ],
      canonicalValueDomainFactIdentity,
    );

    reportCanonicalValueDomainCandidates({
      candidates,
      onlyWhenOwned: true,
      reportIncompleteValues: false,
      reporter: fixture.reporter,
    });

    expect(fixture.reportVocabulary).toHaveBeenCalledWith(
      { canonicalItems: ["draft", "published", "archived"], node: ARRAY_NODE },
      { onlyWhenOwned: false },
    );
  });

  test("non-local and non-vocabulary candidates do not produce a vocabulary report", () => {
    const fixture = reporterFixture();
    const candidates = closedCandidateSet(
      [
        localVocabularyFact(["draft", "published"], { localContribution: false }),
        localVocabularyFact([true, false]),
        localVocabularyFact(["draft"]),
      ],
      canonicalValueDomainFactIdentity,
    );

    reportCanonicalValueDomainCandidates({
      candidates,
      onlyWhenOwned: false,
      reportIncompleteValues: false,
      reporter: fixture.reporter,
    });

    expect(fixture.reportVocabulary).not.toHaveBeenCalled();
  });
});
