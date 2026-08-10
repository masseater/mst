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

const byName = (left: LibraryVocabularyEntry, right: LibraryVocabularyEntry): number => {
  const leftKey = `${left.packageName} ${left.typeName}`;
  const rightKey = `${right.packageName} ${right.typeName}`;
  return leftKey === rightKey ? 0 : leftKey < rightKey ? -1 : 1;
};

export const buildLibraryVocabularyIndex = (
  harvested: readonly LibraryVocabularyEntry[],
): LibraryVocabularyIndex => {
  const oneNamePerDeclaration = new Map<string, LibraryVocabularyEntry>();
  for (const entry of [...harvested].sort(byName)) {
    if (oneNamePerDeclaration.has(entry.declarationId)) continue;
    oneNamePerDeclaration.set(entry.declarationId, entry);
  }
  return [...oneNamePerDeclaration.values()].sort(byName);
};

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
