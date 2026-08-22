import { analyzeCanonicalValuesRepository } from "./builder.ts";
import { buildCatalog, type CanonicalValuesCatalog, type CanonicalValuesEntry } from "./catalog.ts";

export type CanonicalValuesInspection = {
  readonly catalog: CanonicalValuesCatalog;
  readonly problems: ReturnType<typeof analyzeCanonicalValuesRepository>["problems"];
};

export const inspectCanonicalValues = (inspectionRequest: {
  readonly repositoryRoot: string;
}): CanonicalValuesInspection => {
  const analyzed = analyzeCanonicalValuesRepository(inspectionRequest);
  return { catalog: analyzed.catalog, problems: analyzed.problems };
};

export const findEquivalentConcepts = (
  declarations: readonly CanonicalValuesEntry[],
): readonly (readonly CanonicalValuesEntry[])[] =>
  [...buildCatalog(declarations).entriesByFingerprint.values()].filter(
    (grouped) => new Set(grouped.map((declaration) => declaration.conceptId)).size > 1,
  );

export { formatCanonicalValuesProblem, formatEquivalentConceptGroup } from "./verify-format.ts";
