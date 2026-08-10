import { canonicalValueKey, type CanonicalValue } from "../canonical-values/fingerprint.ts";

import type { LibraryVocabularyEntry } from "./vocabulary-index.ts";

const spellValues = (values: readonly CanonicalValue[]): string =>
  values.map((value) => JSON.stringify(value)).join(" | ");

export const describeLibraryOwner = (
  entry: LibraryVocabularyEntry,
  values: readonly CanonicalValue[],
): string => {
  const written = new Set(values.map(canonicalValueKey));
  const beyond = entry.values.filter((value) => !written.has(canonicalValueKey(value)));

  const admitted = [
    ...(beyond.length === 0 ? [] : [spellValues(beyond)]),
    ...(entry.admitsUnnamedValues ? ["values that are not spelled out as literals"] : []),
  ];

  const name = `${entry.typeName} from ${entry.packageName}`;
  return admitted.length === 0
    ? name
    : `${name} (which also admits ${admitted.join(" and ")}, so narrow it)`;
};
