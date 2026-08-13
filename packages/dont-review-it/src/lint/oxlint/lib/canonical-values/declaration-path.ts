import { toPosixPath } from "../posix-path.ts";

import type { CanonicalValuesCatalog, CanonicalValuesEntry } from "./catalog.ts";

const matchesDeclarationPath = (path: string, listed: CanonicalValuesEntry): boolean => {
  const normalizedText = toPosixPath(path);
  return (
    normalizedText === listed.declarationPath ||
    normalizedText.endsWith(`/${listed.declarationPath}`)
  );
};

export const declaresConceptAt = (
  catalog: CanonicalValuesCatalog,
  { conceptId, path }: { readonly conceptId: string; readonly path: string },
): boolean =>
  catalog.entries.some(
    (listed) => listed.conceptId === conceptId && matchesDeclarationPath(path, listed),
  );
