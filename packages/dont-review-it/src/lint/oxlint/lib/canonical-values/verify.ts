import { resolve } from "node:path";

import { readAnnotatedSources, type AnnotatedSource } from "./annotated-sources.ts";
import { buildCatalog, type CanonicalValuesEntry } from "./catalog.ts";
import { listRepositoryFiles } from "./source-files.ts";

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

type DeclarationSite = {
  readonly conceptId: string;
  readonly filePath: string;
  readonly line: number;
};

const declarationSitesIn = (source: AnnotatedSource): readonly DeclarationSite[] =>
  source.declarations.map((declaration) => ({
    conceptId: declaration.conceptId,
    filePath: source.relativePath,
    line: declaration.line,
  }));

const duplicateConceptProblem = (
  first: DeclarationSite,
  site: DeclarationSite,
): CanonicalValuesProblem => ({
  kind: "duplicate-concept",
  filePath: site.filePath,
  line: site.line,
  conceptId: site.conceptId,
  declaredFilePath: first.filePath,
  declaredLine: first.line,
});

export const verifyCanonicalValues = (options: {
  readonly repositoryRoot: string;
}): readonly CanonicalValuesProblem[] => {
  const sources = readAnnotatedSources(listRepositoryFiles(resolve(options.repositoryRoot)));
  const firstSiteByConcept = new Map<string, DeclarationSite>();

  return sources.flatMap((source) => [
    ...source.problems.map((problem) => ({ ...problem, filePath: source.relativePath })),
    ...declarationSitesIn(source).flatMap((site) => {
      const first = firstSiteByConcept.get(site.conceptId);
      if (first === undefined) {
        firstSiteByConcept.set(site.conceptId, site);
        return [];
      }
      return [duplicateConceptProblem(first, site)];
    }),
  ]);
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
  [...new Set(values.map((value) => JSON.stringify(value)))].toSorted().join(", ");

export const formatEquivalentConceptGroup = (group: readonly CanonicalValuesEntry[]): string => {
  const declarations = group
    .map((entry) => `${entry.conceptId} (${entry.declarationPath})`)
    .join(", ");
  return `${formatValues(group.flatMap((entry) => entry.values))} is declared by more than one concept: ${declarations}`;
};
