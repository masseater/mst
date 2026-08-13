import { containsCanonicalValuesAnnotation } from "./annotation.ts";
import {
  scanCanonicalValuesText,
  type CanonicalValuesDeclaration,
  type CanonicalValuesTextProblem,
} from "./declarations.ts";
import { readTextFile, type RepositoryFiles, type ScannedFile } from "./source-files.ts";

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
  if (
    !containsCanonicalValuesAnnotation(sourceText) &&
    !sourceText.includes("oxlint-disable") &&
    !sourceText.includes("eslint-disable")
  ) {
    return null;
  }

  const scanned = scanCanonicalValuesText(sourceText, file.absolutePath);
  const canDeclare = declaringPaths.has(file.absolutePath);
  return {
    absolutePath: file.absolutePath,
    relativePath: file.relativePath,
    declarations: canDeclare ? scanned.declarations : [],
    problems: canDeclare
      ? scanned.problems
      : [
          ...scanned.problems,
          ...scanned.declarations.map((declaration) => ({
            kind: "out-of-scope-declaration" as const,
            line: declaration.line,
            conceptId: declaration.conceptId,
          })),
        ],
  };
};

const readAnnotatedFiles = (
  files: readonly ScannedFile[],
  declaringPaths: ReadonlySet<string>,
): readonly AnnotatedSource[] =>
  files.map((file) => readAnnotatedFile(file, declaringPaths)).filter((source) => source !== null);

const declaringPathsOf = (repositoryFiles: RepositoryFiles): ReadonlySet<string> =>
  new Set(repositoryFiles.declarationSources.map((file) => file.absolutePath));

export const readAnnotatedSources = (
  repositoryFiles: RepositoryFiles,
): readonly AnnotatedSource[] =>
  readAnnotatedFiles(repositoryFiles.commentSources, declaringPathsOf(repositoryFiles));
