import { dirname, resolve } from "node:path";

import { attempt, memoize, sortBy, uniqBy } from "es-toolkit";

import { readGitSourceScope, type GitSourceScope } from "../git-ignored-source.ts";
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

const hasDuplicateDeclarations = (
  declarations: CanonicalValuesDeclarationSite[],
): declarations is [
  CanonicalValuesDeclarationSite,
  CanonicalValuesDeclarationSite,
  ...CanonicalValuesDeclarationSite[],
] => declarations.length > 1;

const duplicateConceptsIn = (
  declarations: readonly CanonicalValuesDeclarationSite[],
): {
  readonly conceptIds: ReadonlySet<string>;
  readonly problems: readonly CanonicalValuesDuplicateProblem[];
} => {
  const conceptGroups = [
    ...Map.groupBy(declarations, (declaration) => declaration.conceptId).values(),
  ];
  const duplicates = conceptGroups.filter(hasDuplicateDeclarations);
  return {
    conceptIds: new Set(duplicates.map(([first]) => first.conceptId)),
    problems: duplicates.flatMap(([first, ...rest]) => {
      return rest.map(
        (declaration): CanonicalValuesDuplicateProblem => ({
          kind: "duplicate-concept",
          filePath: declaration.relativePath,
          line: declaration.line,
          conceptId: declaration.conceptId,
          declaredFilePath: first.relativePath,
          declaredLine: first.line,
        }),
      );
    }),
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
  sourceScope,
}: {
  readonly repositoryFiles: RepositoryFiles;
  readonly repositoryRoot: string;
  readonly sourceScope: GitSourceScope;
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
  const catalogEntries = repositoryFiles.problems.length === 0 ? resolved.entries : [];

  return {
    catalog: buildCatalog(sortBy(catalogEntries, ["declarationPath", "declarationStart"]), {
      packageNames: packageNamesIn(repositoryFiles.manifests),
      sourceScope,
    }),
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
  const sourceScope = readGitSourceScope(root);
  return analyzeRepositoryFiles({
    repositoryFiles: listRepositoryFiles(root, sourceScope),
    repositoryRoot: root,
    sourceScope,
  });
};

const buildCanonicalValuesCatalog = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): CanonicalValuesCatalog => buildCatalogFor(repositoryInput(resolve(repositoryRoot)));

type CanonicalValuesRepositoryInput = {
  readonly fingerprint: string;
  readonly repositoryFiles: RepositoryFiles;
  readonly repositoryRoot: string;
  readonly sourceScope: GitSourceScope;
};

const repositoryInput = (repositoryRoot: string): CanonicalValuesRepositoryInput => {
  const sourceScope = readGitSourceScope(repositoryRoot);
  const repositoryFiles = listRepositoryFiles(repositoryRoot, sourceScope);
  return {
    fingerprint: cacheInputFingerprint(repositoryFiles.cacheInputs, repositoryFiles.problems),
    repositoryFiles,
    repositoryRoot,
    sourceScope,
  };
};

const buildCatalogFor = (input: CanonicalValuesRepositoryInput): CanonicalValuesCatalog => {
  const { fingerprint, repositoryFiles, repositoryRoot, sourceScope } = input;
  const packageNames = packageNamesIn(repositoryFiles.manifests);
  if (repositoryFiles.problems.length > 0 || repositoryFiles.declarationSources.length === 0) {
    return buildCatalog([], { packageNames, sourceScope });
  }

  const cached = readCachedEntries(repositoryRoot, fingerprint);
  if (cached !== null) return buildCatalog(cached, { packageNames, sourceScope });
  return buildAndCacheCatalog({ fingerprint, repositoryFiles, repositoryRoot, sourceScope });
};

const buildAndCacheCatalog = (input: {
  readonly fingerprint: string;
  readonly repositoryFiles: RepositoryFiles;
  readonly repositoryRoot: string;
  readonly sourceScope: GitSourceScope;
}): CanonicalValuesCatalog => {
  const analyzed = analyzeRepositoryFiles(input);
  writeCachedEntries(input.repositoryRoot, {
    fingerprint: input.fingerprint,
    entries: analyzed.catalog.entries,
  });
  return analyzed.catalog;
};

export const loadCanonicalValuesCatalogSnapshot = memoize(buildCanonicalValuesCatalog, {
  getCacheKey: (catalogRequest) => resolve(catalogRequest.repositoryRoot),
});
