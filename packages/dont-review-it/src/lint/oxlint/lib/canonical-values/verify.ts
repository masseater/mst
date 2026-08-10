import { resolve } from "node:path";

import { readAnnotatedSources } from "./annotated-sources.ts";
import { buildCatalog } from "./catalog.ts";
import { listRepositoryFiles } from "./source-files.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";
import type { CanonicalValuesTextProblem } from "./declarations.ts";
import type { CanonicalValue } from "./fingerprint.ts";

export type CanonicalValuesProblem =
  | (CanonicalValuesTextProblem & { readonly filePath: string })
  | {
      readonly kind: "duplicate-concept";
      readonly filePath: string;
      readonly line: number;
      readonly conceptId: string;
      readonly declaredFilePath: string;
      readonly declaredLine: number;
    };

export const verifyCanonicalValues = (options: {
  readonly repositoryRoot: string;
}): readonly CanonicalValuesProblem[] => {
  const problems: CanonicalValuesProblem[] = [];
  const declaredBy = new Map<string, { readonly filePath: string; readonly line: number }>();

  for (const source of readAnnotatedSources(listRepositoryFiles(resolve(options.repositoryRoot)))) {
    for (const problem of source.problems) {
      problems.push({ ...problem, filePath: source.relativePath });
    }

    for (const declaration of source.declarations) {
      const declared = declaredBy.get(declaration.conceptId);
      if (declared === undefined) {
        declaredBy.set(declaration.conceptId, {
          filePath: source.relativePath,
          line: declaration.line,
        });
        continue;
      }
      problems.push({
        kind: "duplicate-concept",
        filePath: source.relativePath,
        line: declaration.line,
        conceptId: declaration.conceptId,
        declaredFilePath: declared.filePath,
        declaredLine: declared.line,
      });
    }
  }
  return problems;
};

export const findEquivalentConcepts = (
  entries: readonly CanonicalValuesEntry[],
): readonly (readonly CanonicalValuesEntry[])[] =>
  [...buildCatalog(entries).entriesByFingerprint.values()].filter(
    (grouped) => new Set(grouped.map((entry) => entry.conceptId)).size > 1,
  );

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
  [...new Set(values.map((value) => JSON.stringify(value)))].sort().join(", ");

export const formatEquivalentConceptGroup = (group: readonly CanonicalValuesEntry[]): string => {
  const declarations = group
    .map((entry) => `${entry.conceptId} (${entry.declarationPath})`)
    .join(", ");
  return `${formatValues(group.flatMap((entry) => entry.values))} is declared by more than one concept: ${declarations}`;
};
