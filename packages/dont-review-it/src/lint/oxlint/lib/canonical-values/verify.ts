import { analyzeCanonicalValuesRepository } from "./builder.ts";
import { buildCatalog, type CanonicalValuesCatalog, type CanonicalValuesEntry } from "./catalog.ts";

export type CanonicalValuesInspection = {
  readonly catalog: CanonicalValuesCatalog;
  readonly problems: ReturnType<typeof analyzeCanonicalValuesRepository>["problems"];
};

export const inspectCanonicalValues = (options: {
  readonly repositoryRoot: string;
}): CanonicalValuesInspection => {
  const analyzed = analyzeCanonicalValuesRepository(options);
  return { catalog: analyzed.catalog, problems: analyzed.problems };
};

export const findEquivalentConcepts = (
  entries: readonly CanonicalValuesEntry[],
): readonly (readonly CanonicalValuesEntry[])[] =>
  [...buildCatalog(entries).entriesByFingerprint.values()].filter(
    (grouped) => new Set(grouped.map((entry) => entry.conceptId)).size > 1,
  );

export { formatCanonicalValuesProblem, formatEquivalentConceptGroup } from "./verify-format.ts";
