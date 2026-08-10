import type { CanonicalValuesCatalog, CanonicalValuesEntry } from "./catalog.ts";

const toPosixPath = (path: string): string => path.replaceAll("\\", "/");

const matchesDeclarationPath = (path: string, entry: CanonicalValuesEntry): boolean => {
  const normalized = toPosixPath(path);
  return normalized === entry.declarationPath || normalized.endsWith(`/${entry.declarationPath}`);
};

export type ConceptDeclarationSite = {
  readonly conceptId: string;
  readonly path: string;
};

export const declaresConceptAt = (
  catalog: CanonicalValuesCatalog,
  { conceptId, path }: ConceptDeclarationSite,
): boolean =>
  catalog.entries.some(
    (entry) => entry.conceptId === conceptId && matchesDeclarationPath(path, entry),
  );
