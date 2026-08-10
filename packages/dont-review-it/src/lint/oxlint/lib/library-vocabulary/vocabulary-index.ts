import { sortBy, uniqBy } from "es-toolkit";

import { canonicalValueKey } from "../canonical-values/fingerprint.ts";

import type { CanonicalValue } from "../canonical-values/fingerprint.ts";

export type LibraryVocabularyEntry = {
  readonly packageName: string;
  readonly typeName: string;
  readonly declarationId: string;
  readonly values: readonly CanonicalValue[];
  readonly admitsUnnamedValues: boolean;
};

export type LibraryVocabularyIndex = readonly LibraryVocabularyEntry[];

export const EMPTY_LIBRARY_VOCABULARY_INDEX: LibraryVocabularyIndex = [];

const NAME_ORDER = ["packageName", "typeName"] as const;

export const buildLibraryVocabularyIndex = (
  harvested: readonly LibraryVocabularyEntry[],
): LibraryVocabularyIndex =>
  sortBy(
    uniqBy(sortBy(harvested, [...NAME_ORDER]), (entry) => entry.declarationId),
    [...NAME_ORDER],
  );

export const libraryOwnersOf = (
  index: LibraryVocabularyIndex,
  values: readonly CanonicalValue[],
): readonly LibraryVocabularyEntry[] => {
  const written = new Set(values.map(canonicalValueKey));
  if (written.size === 0) return [];
  return index.filter((entry) => {
    const admitted = new Set(entry.values.map(canonicalValueKey));
    return [...written].every((value) => admitted.has(value));
  });
};
