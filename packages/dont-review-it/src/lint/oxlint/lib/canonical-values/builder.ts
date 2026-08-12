import { dirname, resolve } from "node:path";

import { attempt, sortBy, uniqBy } from "es-toolkit";

import { readAnnotatedSources, type AnnotatedSource } from "./annotated-sources.ts";
import { cacheInputFingerprint, readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";
import { buildCatalog, type CanonicalValuesCatalog } from "./catalog.ts";
import { publicPackageName } from "./export-specifier-index.ts";
import {
  resolveCanonicalValuesEntries,
  type CanonicalValuesDeclarationSite,
  type CanonicalValuesSourceProblem,
} from "./resolved-entries.ts";
import {
  listRepositoryFiles,
  type RepositoryFileProblem,
  type RepositoryFiles,
} from "./source-files.ts";

type CanonicalValuesDuplicateProblem = {
  readonly kind: "duplicate-concept";
  readonly filePath: string;
  readonly line: number;
  readonly conceptId: string;
  readonly declaredFilePath: string;
  readonly declaredLine: number;
};

export type CanonicalValuesRepositoryProblem =
  | CanonicalValuesSourceProblem
  | CanonicalValuesDuplicateProblem
  | RepositoryFileProblem;

export type CanonicalValuesRepositoryAnalysis = {
  readonly catalog: CanonicalValuesCatalog;
  readonly declarations: readonly CanonicalValuesDeclarationSite[];
  readonly problems: readonly CanonicalValuesRepositoryProblem[];
};

const declarationSitesIn = (
  sources: readonly AnnotatedSource[],
): readonly CanonicalValuesDeclarationSite[] =>
  sources.flatMap((source) =>
    source.declarations.map((declaration) => ({
      ...declaration,
      absolutePath: source.absolutePath,
      relativePath: source.relativePath,
    })),
  );

const sourceProblemsIn = (
  sources: readonly AnnotatedSource[],
): readonly CanonicalValuesSourceProblem[] =>
  sources.flatMap((source) =>
    source.problems.map((problem) => ({ ...problem, filePath: source.relativePath })),
  );

const duplicateConceptsIn = (
  declarations: readonly CanonicalValuesDeclarationSite[],
): {
  readonly conceptIds: ReadonlySet<string>;
  readonly problems: readonly CanonicalValuesDuplicateProblem[];
} => {
  const groups = [...Map.groupBy(declarations, (declaration) => declaration.conceptId).values()];
  const duplicates = groups.filter((group) => group.length > 1);
  return {
    conceptIds: new Set(duplicates.flatMap((group) => group[0]?.conceptId ?? [])),
    problems: duplicates.flatMap(([first, ...rest]) =>
      first === undefined
        ? []
        : rest.map(
            (declaration): CanonicalValuesDuplicateProblem => ({
              kind: "duplicate-concept",
              filePath: declaration.relativePath,
              line: declaration.line,
              conceptId: declaration.conceptId,
              declaredFilePath: first.relativePath,
              declaredLine: first.line,
            }),
          ),
    ),
  };
};

const packageNamesIn = (manifests: RepositoryFiles["manifests"]): readonly string[] =>
  uniqBy(
    manifests.flatMap((manifest) => {
      const [failure, packageName] = attempt(() =>
        publicPackageName(dirname(manifest.absolutePath)),
      );
      return failure === null && packageName !== null ? [packageName] : [];
    }),
    (packageName) => packageName,
  );

const analyzeRepositoryFiles = ({
  repositoryFiles,
  repositoryRoot,
}: {
  readonly repositoryFiles: RepositoryFiles;
  readonly repositoryRoot: string;
}): CanonicalValuesRepositoryAnalysis => {
  const sources = readAnnotatedSources(repositoryFiles);
  const declarations = declarationSitesIn(sources);
  const duplicates = duplicateConceptsIn(declarations);
  const resolvableDeclarations = declarations.filter(
    (declaration) => !duplicates.conceptIds.has(declaration.conceptId),
  );
  const resolved = resolveCanonicalValuesEntries({
    declarations: resolvableDeclarations,
    repositoryRoot,
    sourceFiles: repositoryFiles.commentSources.map((source) => source.absolutePath),
  });
  const entries = repositoryFiles.problems.length === 0 ? resolved.entries : [];

  return {
    catalog: buildCatalog(
      sortBy(entries, ["declarationPath", "declarationStart"]),
      packageNamesIn(repositoryFiles.manifests),
    ),
    declarations,
    problems: [
      ...repositoryFiles.problems,
      ...sourceProblemsIn(sources),
      ...duplicates.problems,
      ...resolved.problems,
    ],
  };
};

export const analyzeCanonicalValuesRepository = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): CanonicalValuesRepositoryAnalysis => {
  const root = resolve(repositoryRoot);
  return analyzeRepositoryFiles({
    repositoryFiles: listRepositoryFiles(root),
    repositoryRoot: root,
  });
};

export const buildCanonicalValuesCatalog = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): CanonicalValuesCatalog => buildCatalogFor(repositoryInput(resolve(repositoryRoot)));

type CanonicalValuesRepositoryInput = {
  readonly fingerprint: string;
  readonly repositoryFiles: RepositoryFiles;
  readonly repositoryRoot: string;
};

const repositoryInput = (repositoryRoot: string): CanonicalValuesRepositoryInput => {
  const repositoryFiles = listRepositoryFiles(repositoryRoot);
  return {
    fingerprint: cacheInputFingerprint(repositoryFiles.cacheInputs, repositoryFiles.problems),
    repositoryFiles,
    repositoryRoot,
  };
};

const buildCatalogFor = (input: CanonicalValuesRepositoryInput): CanonicalValuesCatalog => {
  const { fingerprint, repositoryFiles, repositoryRoot } = input;
  const packageNames = packageNamesIn(repositoryFiles.manifests);
  if (repositoryFiles.problems.length > 0 || repositoryFiles.declarationSources.length === 0) {
    return buildCatalog([], packageNames);
  }

  const cached = readCachedEntries(repositoryRoot, fingerprint);
  if (cached !== null) return buildCatalog(cached, packageNames);
  return buildAndCacheCatalog({ fingerprint, repositoryFiles, repositoryRoot });
};

const buildAndCacheCatalog = (input: {
  readonly fingerprint: string;
  readonly repositoryFiles: RepositoryFiles;
  readonly repositoryRoot: string;
}): CanonicalValuesCatalog => {
  const analyzed = analyzeRepositoryFiles(input);
  writeCachedEntries(input.repositoryRoot, {
    fingerprint: input.fingerprint,
    entries: analyzed.catalog.entries,
  });
  return analyzed.catalog;
};

const catalogByRepositoryRoot = new Map<
  string,
  { readonly catalog: CanonicalValuesCatalog; readonly fingerprint: string }
>();

export const loadCanonicalValuesCatalog = (options: {
  readonly repositoryRoot: string;
}): CanonicalValuesCatalog => {
  const root = resolve(options.repositoryRoot);
  const input = repositoryInput(root);
  const memoized = catalogByRepositoryRoot.get(root);
  if (memoized?.fingerprint === input.fingerprint) return memoized.catalog;

  const built = buildCatalogFor(input);
  catalogByRepositoryRoot.set(root, { catalog: built, fingerprint: input.fingerprint });
  return built;
};
