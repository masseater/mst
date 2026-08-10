import type { CanonicalValuesCatalog, CanonicalValuesEntry } from "./catalog.ts";

const toPosixPath = (path: string): string => path.replaceAll("\\", "/");

export const matchesDeclarationPath = (path: string, entry: CanonicalValuesEntry): boolean => {
  const normalized = toPosixPath(path);
  return normalized === entry.declarationPath || normalized.endsWith(`/${entry.declarationPath}`);
};

export const declaresConceptAt = (
  catalog: CanonicalValuesCatalog,
  conceptId: string,
  path: string,
): boolean =>
  catalog.entries.some(
    (entry) => entry.conceptId === conceptId && matchesDeclarationPath(path, entry),
  );
