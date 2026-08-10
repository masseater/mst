import { containsCanonicalValuesAnnotation } from "./annotation.ts";
import { scanCanonicalValuesText } from "./declarations.ts";
import { readTextFile } from "./source-files.ts";

import type { CanonicalValuesDeclaration, CanonicalValuesTextProblem } from "./declarations.ts";
import type { RepositoryFiles, ScannedFile } from "./source-files.ts";

export type AnnotatedSource = {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly declarations: readonly CanonicalValuesDeclaration[];
  readonly problems: readonly CanonicalValuesTextProblem[];
};

const readAnnotatedFiles = (
  files: readonly ScannedFile[],
  declaringPaths: ReadonlySet<string>,
): readonly AnnotatedSource[] => {
  const sources: AnnotatedSource[] = [];
  for (const file of files) {
    const sourceText = readTextFile(file.absolutePath);
    if (sourceText === null) continue;
    if (!containsCanonicalValuesAnnotation(sourceText)) continue;

    const scanned = scanCanonicalValuesText(sourceText);
    const source: AnnotatedSource = {
      absolutePath: file.absolutePath,
      relativePath: file.relativePath,
      declarations: declaringPaths.has(file.absolutePath) ? scanned.declarations : [],
      problems: scanned.problems,
    };
    sources.push(source);
  }
  return sources;
};

const declaringPathsOf = (repositoryFiles: RepositoryFiles): ReadonlySet<string> =>
  new Set(repositoryFiles.declarationSources.map((file) => file.absolutePath));

export const readDeclarationSources = (
  repositoryFiles: RepositoryFiles,
): readonly AnnotatedSource[] =>
  readAnnotatedFiles(repositoryFiles.declarationSources, declaringPathsOf(repositoryFiles));

export const readAnnotatedSources = (
  repositoryFiles: RepositoryFiles,
): readonly AnnotatedSource[] =>
  readAnnotatedFiles(repositoryFiles.commentSources, declaringPathsOf(repositoryFiles));
