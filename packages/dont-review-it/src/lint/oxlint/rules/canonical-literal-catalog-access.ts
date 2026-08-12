import { memoize } from "es-toolkit";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";

import type { CanonicalValuesCatalogLoader } from "../lib/canonical-values/catalog-loader.ts";
import type { CanonicalValuesCatalog } from "../lib/canonical-values/catalog.ts";

const createCanonicalLiteralCatalogAccess = ({
  cwd,
  loadCatalog,
}: {
  readonly cwd: string;
  readonly loadCatalog: CanonicalValuesCatalogLoader;
}): {
  readonly loadedCatalog: () => CanonicalValuesCatalog;
  readonly repositoryRootOf: () => string;
} => {
  const repositoryRootOf = memoize((): string => findWorkspaceRoot(cwd));
  const loadedCatalog = memoize(
    (): CanonicalValuesCatalog => loadCatalog({ repositoryRoot: repositoryRootOf() }),
  );
  return { loadedCatalog, repositoryRootOf };
};

export { createCanonicalLiteralCatalogAccess };
