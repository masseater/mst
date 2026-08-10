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

const readAnnotatedFile = (
  file: ScannedFile,
  declaringPaths: ReadonlySet<string>,
): AnnotatedSource | null => {
  const sourceText = readTextFile(file.absolutePath);
  if (sourceText === null) return null;
  if (!containsCanonicalValuesAnnotation(sourceText)) return null;

  const scanned = scanCanonicalValuesText(sourceText, file.absolutePath);
  return {
    absolutePath: file.absolutePath,
    relativePath: file.relativePath,
    declarations: declaringPaths.has(file.absolutePath) ? scanned.declarations : [],
    problems: scanned.problems,
  };
};

const readAnnotatedFiles = (
  files: readonly ScannedFile[],
  declaringPaths: ReadonlySet<string>,
): readonly AnnotatedSource[] =>
  files.map((file) => readAnnotatedFile(file, declaringPaths)).filter((source) => source !== null);

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
