import { dirname } from "node:path";

import { memoize, sortBy } from "es-toolkit";

import { buildExportSpecifierIndex } from "./export-specifier-index.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { nearestPackageDirectory } from "./source-files.ts";

import type { AnnotatedSource } from "./annotated-sources.ts";
import type { CanonicalValuesEntry } from "./catalog.ts";

export const canonicalValuesEntriesIn = (
  repositoryRoot: string,
  sources: readonly AnnotatedSource[],
): readonly CanonicalValuesEntry[] => {
  const specifierIndexFor = memoize(buildExportSpecifierIndex);

  const canonicalValuesEntries = sources.flatMap((source) => {
    if (source.declarations.length === 0) return [];

    const packageDirectory = nearestPackageDirectory(dirname(source.absolutePath), repositoryRoot);
    const exportPath =
      packageDirectory === null
        ? null
        : (specifierIndexFor(packageDirectory).get(source.absolutePath) ?? null);

    return source.declarations.map((declaration) => ({
      conceptId: declaration.conceptId,
      declarationPath: source.relativePath,
      exportPath,
      values: declaration.values,
      fingerprint: fingerprintValues(declaration.values),
    }));
  });

  return sortBy(canonicalValuesEntries, ["declarationPath", "conceptId"]);
};
