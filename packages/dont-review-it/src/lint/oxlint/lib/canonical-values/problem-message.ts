import type { CanonicalValuesEntry } from "./catalog.ts";
import type { CanonicalValue } from "./fingerprint.ts";
import type { CanonicalValuesProblem } from "./verify.ts";

export const formatCanonicalValuesProblem = (problem: CanonicalValuesProblem): string => {
  const location = `${problem.filePath}:${problem.line}`;
  if (problem.kind === "retired-annotation-tag") {
    return `${location} The retired annotation tag ${problem.tag} must not stay in the source, because opting a value set out of the canonical vocabulary is no longer possible. Delete the tag, and declare the concept it belonged to so every use derives from that declaration.`;
  }
  if (problem.kind === "unparsable-annotation") {
    return `${location} A canonical values annotation must name the concept it declares. Write the tag followed by a concept id built from lowercase words joined by "-" or ".".`;
  }
  if (problem.kind === "vocabulary-without-values") {
    return `${location} A canonical values annotation must sit on a declaration that spells out the values of ${problem.conceptId}. Move the annotation onto the declaration that lists them, or delete it.`;
  }
  return `${location} A concept must be declared in one place. ${problem.conceptId} is already declared at ${problem.declaredFilePath}:${problem.declaredLine}. Delete one of the two declarations, and derive from the one that stays.`;
};

const formatValues = (values: readonly CanonicalValue[]): string =>
  [...new Set(values.map((value) => JSON.stringify(value)))].toSorted().join(", ");

export const formatEquivalentConceptGroup = (group: readonly CanonicalValuesEntry[]): string => {
  const declarations = group
    .map((entry) => `${entry.conceptId} (${entry.declarationPath})`)
    .join(", ");
  return `${group.map((entry) => entry.declarationPath).join(" ")} One set of values must belong to one concept, because two names for the same set let each of them drift on its own. ${formatValues(group.flatMap((entry) => entry.values))} is declared by ${declarations}. Keep one of the concepts, and derive the others from the declaration that stays.`;
};
