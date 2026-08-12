import { memoize } from "es-toolkit";

import {
  registeredDeclarationRanges,
  type AnnotatedDeclarationRange,
} from "../lib/canonical-values/annotated-declaration.ts";
import { fingerprintValues, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import { ownershipPolicyOf } from "../lib/canonical-values/ownership-policy.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { describeLibraryOwner } from "../lib/library-vocabulary/owner-description.ts";
import {
  libraryOwnersOf,
  type LibraryVocabularyIndex,
} from "../lib/library-vocabulary/vocabulary-index.ts";
import {
  canonicalValueOwnerInitializer,
  canonicalValueOwnerResultExpressions,
} from "./canonical-value-owner-initializer.ts";

import type { Context, ESTree } from "@oxlint/plugins";
import type { CanonicalValuesCatalogLoader } from "../lib/canonical-values/catalog-loader.ts";
import type {
  CanonicalValuesCatalog,
  CanonicalValuesEntry,
} from "../lib/canonical-values/catalog.ts";
import type { LibraryVocabularyLoader } from "../lib/library-vocabulary/vocabulary-loader.ts";
import type { RuleMessage } from "../lib/rule-message.ts";

type OwnerInitializerSpan = {
  readonly end: number;
  readonly fingerprint: string;
  readonly start: number;
};

const initializerSpansFor = (
  program: ESTree.Program,
  range: AnnotatedDeclarationRange,
): readonly OwnerInitializerSpan[] => {
  const initializer = canonicalValueOwnerInitializer({ program, range });
  if (initializer === null) return [];
  return canonicalValueOwnerResultExpressions(initializer).map((result) => ({
    end: result.end,
    fingerprint: range.fingerprint,
    start: result.start,
  }));
};

const ownerInitializerSpans = (
  program: ESTree.Program,
  ranges: readonly AnnotatedDeclarationRange[],
): readonly OwnerInitializerSpan[] =>
  ranges.flatMap((range) => initializerSpansFor(program, range));

const describeOwner = (entry: CanonicalValuesEntry): string => {
  const route = entry.importRoutes[0]?.specifier ?? entry.declarationPath;
  return `${entry.conceptId} (${route})`;
};

const catalogOwnerReport = (
  owners: readonly CanonicalValuesEntry[],
  ownershipPolicy: string,
): RuleMessage => {
  const [onlyOwner] = owners;
  return owners.length === 1 && onlyOwner !== undefined
    ? {
        messageId: "localFiniteValueSetWithOwner",
        data: { owner: describeOwner(onlyOwner), ownershipPolicy },
      }
    : {
        messageId: "localFiniteValueSetWithOwnerCandidates",
        data: { owners: owners.map(describeOwner).join(", "), ownershipPolicy },
      };
};

const libraryOwnerReport = ({
  libraries,
  canonicalItems,
  ownershipPolicy,
}: {
  readonly canonicalItems: readonly CanonicalValue[];
  readonly libraries: ReturnType<typeof libraryOwnersOf>;
  readonly ownershipPolicy: string;
}): RuleMessage => {
  const [onlyLibrary] = libraries;
  if (libraries.length === 0) {
    return { messageId: "localFiniteValueSetWithoutOwner", data: { ownershipPolicy } };
  }
  if (libraries.length === 1 && onlyLibrary !== undefined) {
    return {
      messageId: "localFiniteValueSetOwnedByLibraryType",
      data: { owner: describeLibraryOwner(onlyLibrary, canonicalItems), ownershipPolicy },
    };
  }
  return {
    messageId: "localFiniteValueSetOwnedByLibraryTypeCandidates",
    data: {
      owners: libraries.map((library) => describeLibraryOwner(library, canonicalItems)).join(", "),
      ownershipPolicy,
    },
  };
};

const vocabularyReport = ({
  catalog,
  libraryVocabulary,
  canonicalItems,
  ownershipPolicy,
}: {
  readonly canonicalItems: readonly CanonicalValue[];
  readonly catalog: CanonicalValuesCatalog;
  readonly libraryVocabulary: LibraryVocabularyIndex;
  readonly ownershipPolicy: string;
}): RuleMessage => {
  const owners = catalog.entriesByFingerprint.get(fingerprintValues(canonicalItems)) ?? [];
  return owners.length === 0
    ? libraryOwnerReport({
        libraries: libraryOwnersOf(libraryVocabulary, canonicalItems),
        canonicalItems,
        ownershipPolicy,
      })
    : catalogOwnerReport(owners, ownershipPolicy);
};

export type CanonicalValueReporter = {
  readonly catalog: CanonicalValuesCatalog;
  readonly reportImportRoute: (occurrence: {
    readonly importedName: string;
    readonly node: ESTree.Span;
    readonly specifier: string;
  }) => void;
  readonly reportVocabulary: (
    occurrence: {
      readonly canonicalItems: readonly CanonicalValue[];
      readonly node: ESTree.Span;
    },
    options: { readonly onlyWhenOwned: boolean; readonly supplemental?: boolean },
  ) => void;
  readonly repositoryRoot: string;
};

export const createCanonicalValueReporter = ({
  context,
  loadCatalog,
  loadLibraryVocabulary,
}: {
  readonly context: Context;
  readonly loadCatalog: CanonicalValuesCatalogLoader;
  readonly loadLibraryVocabulary: LibraryVocabularyLoader;
}): CanonicalValueReporter => {
  const repositoryRoot = findWorkspaceRoot(context.cwd);
  const catalog = loadCatalog({ repositoryRoot });
  const declarationRanges = registeredDeclarationRanges({
    catalog,
    filename: context.filename,
    repositoryRoot,
    sourceText: context.sourceCode.text,
  });
  const ownerSpans = ownerInitializerSpans(context.sourceCode.ast, declarationRanges);
  const libraryVocabulary = memoize(
    (): LibraryVocabularyIndex =>
      loadLibraryVocabulary({ filename: context.filename, repositoryRoot }),
  );
  const reportedSpans = new Set<string>();
  const primaryVocabularySpans = new Set<string>();
  const reportOnce = (report: {
    readonly data: Readonly<Record<string, string>>;
    readonly identity: string;
    readonly messageId: string;
    readonly node: ESTree.Span;
  }): void => {
    const spanKey = `${report.node.start}:${report.node.end}:${report.identity}`;
    if (reportedSpans.has(spanKey)) return;
    reportedSpans.add(spanKey);
    context.report(report);
  };

  return {
    catalog,
    repositoryRoot,
    reportImportRoute(occurrence) {
      reportOnce({
        identity: "route",
        node: occurrence.node,
        messageId: "unregisteredCanonicalValuesImportRoute",
        data: { name: occurrence.importedName, specifier: occurrence.specifier },
      });
    },
    reportVocabulary(occurrence, options) {
      const fingerprint = fingerprintValues(occurrence.canonicalItems);
      const vocabularySpan = `${occurrence.node.start}:${occurrence.node.end}`;
      if (options.supplemental === true && primaryVocabularySpans.has(vocabularySpan)) return;
      const exempt = ownerSpans.some(
        (span) =>
          span.fingerprint === fingerprint &&
          span.start === occurrence.node.start &&
          span.end === occurrence.node.end,
      );
      if (exempt) return;
      const owners = catalog.entriesByFingerprint.get(fingerprint) ?? [];
      if (options.onlyWhenOwned && owners.length === 0) return;
      const report = vocabularyReport({
        catalog,
        libraryVocabulary: libraryVocabulary(),
        canonicalItems: occurrence.canonicalItems,
        ownershipPolicy: ownershipPolicyOf(context.options),
      });
      if (options.supplemental !== true) primaryVocabularySpans.add(vocabularySpan);
      reportOnce({
        data: report.data,
        identity: `vocabulary:${fingerprint}`,
        messageId: report.messageId,
        node: occurrence.node,
      });
    },
  };
};
