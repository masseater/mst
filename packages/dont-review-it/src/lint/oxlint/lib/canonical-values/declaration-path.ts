import { toPosixPath } from "../posix-path.ts";

import type { CanonicalValuesCatalog, CanonicalValuesEntry } from "./catalog.ts";

const matchesDeclarationPath = ({
  path,
  repositoryRoot,
  declaration,
}: {
  readonly declaration: CanonicalValuesEntry;
  readonly path: string;
  readonly repositoryRoot: string;
}): boolean => {
  const normalizedPath = toPosixPath(path);
  if (normalizedPath === declaration.declarationPath) return true;
  const normalizedRoot = toPosixPath(repositoryRoot).replace(/\/+$/u, "");
  return normalizedPath === `${normalizedRoot}/${declaration.declarationPath}`;
};

export const declarationEntriesAt = (
  catalog: CanonicalValuesCatalog,
  { path, repositoryRoot }: { readonly path: string; readonly repositoryRoot: string },
): readonly CanonicalValuesEntry[] =>
  catalog.entries.filter((declaration) =>
    matchesDeclarationPath({ declaration, path, repositoryRoot }),
  );
