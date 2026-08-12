import { resolve } from "node:path";

import { readAnnotatedSources, type AnnotatedSource } from "./annotated-sources.ts";
import { buildCatalog, type CanonicalValuesEntry } from "./catalog.ts";
import { listRepositoryFiles } from "./source-files.ts";

import type { CanonicalValuesTextProblem } from "./declarations.ts";

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
  const sites = sources.flatMap(declarationSitesIn);
  const duplicates = sites.flatMap((site, order) => {
    const declared = sites.slice(0, order).find((held) => held.conceptId === site.conceptId);
    return declared === undefined ? [] : [duplicateConceptProblem(declared, site)];
  });

  return sources.flatMap((source) => [
    ...source.problems.map((problem) => ({ ...problem, filePath: source.relativePath })),
    ...duplicates.filter((problem) => problem.filePath === source.relativePath),
  ]);
};

export const findEquivalentConcepts = (
  entries: readonly CanonicalValuesEntry[],
): readonly (readonly CanonicalValuesEntry[])[] =>
  [...buildCatalog(entries).entriesByFingerprint.values()].filter(
    (grouped) => new Set(grouped.map((entry) => entry.conceptId)).size > 1,
  );
