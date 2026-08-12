import { countBy, difference } from "es-toolkit";

import {
  absenceVerificationsIn,
  exportVerificationLocator,
  valueExportsIn,
  type AbsenceVerification,
} from "./verification-source.ts";

import type { SlopCheck } from "../check.ts";
import type { CheckProblem } from "../problem.ts";
import type { ComparisonFile, RepositoryComparison } from "../repository-comparison.ts";

type RemovedFile = {
  readonly locator: string;
  readonly path: string;
};

type RemovedExport = {
  readonly locator: string;
  readonly modulePath: string;
  readonly exportName: string;
};

const SOURCE_EXTENSION = /(\.[cm]?[jt]sx?)$/u;

const isTestFile = (path: string): boolean => /\.test\.[cm]?[jt]sx?$/u.test(path);

const isSourceFile = (path: string): boolean =>
  SOURCE_EXTENSION.test(path) && !/\.d\.[cm]?ts$/u.test(path) && !isTestFile(path);

const testPathFor = (sourcePath: string): string => sourcePath.replace(SOURCE_EXTENSION, ".test$1");

const byLocation = (left: CheckProblem, right: CheckProblem): number =>
  left.file === right.file ? left.line - right.line : left.file.localeCompare(right.file);

const removedFilesIn = (files: readonly ComparisonFile[]): readonly RemovedFile[] =>
  files.flatMap((file) => {
    if (file.kind !== "deleted" || !isSourceFile(file.beforePath)) return [];
    return [{ locator: `file:${file.beforePath}`, path: file.beforePath }];
  });

const removedExportsIn = (files: readonly ComparisonFile[]): readonly RemovedExport[] =>
  files.flatMap((file) => {
    if (
      file.kind !== "changed" ||
      !isSourceFile(file.beforePath) ||
      file.beforeSource === null ||
      file.afterSource === null
    ) {
      return [];
    }
    return difference(
      valueExportsIn({ file: file.beforePath, source: file.beforeSource }),
      valueExportsIn({ file: file.afterPath, source: file.afterSource }),
    ).map((exportName) => ({
      locator: exportVerificationLocator({ modulePath: file.beforePath, exportName }),
      modulePath: file.beforePath,
      exportName,
    }));
  });

const sourceFor = (
  file: ComparisonFile,
  side: "before" | "after",
): {
  readonly file: string;
  readonly source: string;
  readonly addedLines: readonly number[];
} | null => {
  const path = side === "before" ? file.beforePath : file.afterPath;
  const source = side === "before" ? file.beforeSource : file.afterSource;
  return path !== null && source !== null && isTestFile(path)
    ? { file: path, source, addedLines: side === "before" ? [] : file.addedLines }
    : null;
};

type VerificationOccurrence = AbsenceVerification & {
  readonly isAdded: boolean;
};

const verificationTouchesAddedLine = (
  verification: AbsenceVerification,
  addedLines: readonly number[],
): boolean => addedLines.some((line) => line >= verification.line && line <= verification.endLine);

const verificationsIn = (
  files: readonly ComparisonFile[],
  side: "before" | "after",
): readonly VerificationOccurrence[] =>
  files.flatMap((file) => {
    const testSource = sourceFor(file, side);
    if (testSource === null) return [];
    return absenceVerificationsIn(testSource).map((verification) => ({
      ...verification,
      isAdded:
        side === "after" && verificationTouchesAddedLine(verification, testSource.addedLines),
    }));
  });

const addedVerificationsIn = (
  afterVerifications: readonly VerificationOccurrence[],
  beforeVerifications: readonly VerificationOccurrence[],
): readonly VerificationOccurrence[] => {
  const beforeCounts = countBy(beforeVerifications, (verification) => verification.locator);
  const afterCounts = countBy(afterVerifications, (verification) => verification.locator);
  const selectedCounts = new Map<string, number>();
  const prioritizedVerifications = [
    ...afterVerifications.filter((verification) => verification.isAdded),
    ...afterVerifications.filter((verification) => !verification.isAdded),
  ];
  return prioritizedVerifications.filter((verification) => {
    const selectedCount = selectedCounts.get(verification.locator) ?? 0;
    const afterCount = afterCounts[verification.locator] as number;
    const addedCount = afterCount - (beforeCounts[verification.locator] ?? 0);
    if (selectedCount >= addedCount) return false;
    selectedCounts.set(verification.locator, selectedCount + 1);
    return true;
  });
};

const correspondingTestProblems = (
  files: readonly ComparisonFile[],
  removedFiles: readonly RemovedFile[],
): readonly CheckProblem[] => {
  const deletedPathByTestPath = new Map(removedFiles.map(({ path }) => [testPathFor(path), path]));
  return files
    .flatMap((file): readonly CheckProblem[] => {
      if (file.kind !== "added") return [];
      const deletedPath = deletedPathByTestPath.get(file.afterPath);
      if (deletedPath === undefined) return [];
      return [
        {
          file: file.afterPath,
          line: file.firstAddedLine ?? 1,
          message: `Do not add a test for deleted file "${deletedPath}"; remove the test or restore the file.`,
        },
      ];
    })
    .toSorted(byLocation);
};

const fileAssertionProblems = (
  verifications: readonly AbsenceVerification[],
  removedFiles: readonly RemovedFile[],
): readonly CheckProblem[] => {
  const removedLocators = new Set(removedFiles.map(({ locator }) => locator));
  return verifications
    .flatMap((verification): readonly CheckProblem[] =>
      verification.kind === "file" && removedLocators.has(verification.locator)
        ? [
            {
              file: verification.file,
              line: verification.line,
              message: `Do not assert that deleted file "${verification.subjectPath}" remains absent; remove the assertion.`,
            },
          ]
        : [],
    )
    .toSorted(byLocation);
};

const exportAssertionProblems = (
  verifications: readonly AbsenceVerification[],
  removedExports: readonly RemovedExport[],
): readonly CheckProblem[] => {
  const removedByLocator = new Map(removedExports.map((removed) => [removed.locator, removed]));
  return verifications
    .flatMap((verification): readonly CheckProblem[] => {
      if (verification.kind !== "export") return [];
      const removed = removedByLocator.get(verification.locator);
      if (removed === undefined) return [];
      return [
        {
          file: verification.file,
          line: verification.line,
          message: `Do not assert that removed export "${removed.exportName}" from "${removed.modulePath}" remains absent; remove the assertion.`,
        },
      ];
    })
    .toSorted(byLocation);
};

const noRemovalVerificationProblems = (
  comparison: RepositoryComparison,
): readonly CheckProblem[] => {
  const removedFiles = removedFilesIn(comparison.files);
  const removedExports = removedExportsIn(comparison.files);
  const beforeVerifications = verificationsIn(comparison.files, "before");
  const afterVerifications = verificationsIn(comparison.files, "after");
  const addedVerifications = addedVerificationsIn(afterVerifications, beforeVerifications);
  return [
    ...correspondingTestProblems(comparison.files, removedFiles),
    ...fileAssertionProblems(addedVerifications, removedFiles),
    ...exportAssertionProblems(addedVerifications, removedExports),
  ];
};

export const noRemovalVerification: SlopCheck = {
  id: "no-removal-verification",
  run: noRemovalVerificationProblems,
};
