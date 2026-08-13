import { canonicalValueKey, type CanonicalValue } from "../canonical-values/fingerprint.ts";

import type { LibraryVocabularyEntry } from "./vocabulary-index.ts";

const spellValues = (heldValues: readonly CanonicalValue[]): string =>
  heldValues.map((held) => JSON.stringify(held)).join(" | ");

export const describeLibraryOwner = (
  listed: LibraryVocabularyEntry,
  heldValues: readonly CanonicalValue[],
): string => {
  const written = new Set(heldValues.map(canonicalValueKey));
  const beyond = listed.values.filter((held) => !written.has(canonicalValueKey(held)));

  const admitted = [
    ...(beyond.length === 0 ? [] : [spellValues(beyond)]),
    ...(listed.admitsUnnamedValues ? ["values that are not spelled out as literals"] : []),
  ];

  const spelled = `${listed.typeName} from ${listed.packageName}`;
  return admitted.length === 0
    ? spelled
    : `${spelled} (which also admits ${admitted.join(" and ")}, so narrow it)`;
};
