import { join, resolve } from "node:path";

import { uniq } from "es-toolkit";

import { pathIsInside } from "../path-is-inside.ts";
import { toPosixPath } from "../posix-path.ts";
import { EXPORTS_CONDITION_DEPTH_LIMIT } from "./package-manifest.ts";
import { isFile } from "./source-files.ts";

const javaScriptSourceCandidates = (exportTarget: string): readonly string[] =>
  uniq([
    exportTarget.replace(/\.js$/u, ".ts"),
    exportTarget.replace(/\.jsx$/u, ".tsx"),
    exportTarget.replace(/\.mjs$/u, ".mts"),
    exportTarget.replace(/\.cjs$/u, ".cts"),
    exportTarget,
  ]);

const targetCandidates = (packageDirectory: string, exportTarget: string): readonly string[] => {
  const base = resolve(packageDirectory, exportTarget);
  return [
    ...javaScriptSourceCandidates(base),
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
    join(base, "index.mts"),
    join(base, "index.cts"),
  ];
};

export const packageExportSourceFile = (
  packageDirectory: string,
  exportTarget: string,
): string | null => targetCandidates(packageDirectory, exportTarget).find(isFile) ?? null;

export const singleWildcardPattern = (
  pattern: string,
): { readonly prefix: string; readonly suffix: string } | null => {
  const wildcard = pattern.indexOf("*");
  if (wildcard === -1 || pattern.includes("*", wildcard + 1)) return null;
  return { prefix: pattern.slice(0, wildcard), suffix: pattern.slice(wildcard + 1) };
};

const packageExportPatternBaseLength = (pattern: string): number => {
  const wildcard = pattern.indexOf("*");
  return wildcard === -1 ? pattern.length : wildcard + 1;
};

const packageExportPatternKeyCompare = (left: string, right: string): number => {
  const leftBaseLength = packageExportPatternBaseLength(left);
  const rightBaseLength = packageExportPatternBaseLength(right);
  if (leftBaseLength !== rightBaseLength) return leftBaseLength > rightBaseLength ? -1 : 1;
  return left.length === right.length ? 0 : left.length > right.length ? -1 : 1;
};

const packageExportPatternMatches = (pattern: string, subpath: string): boolean => {
  const wildcard = singleWildcardPattern(pattern);
  return (
    wildcard !== null &&
    subpath.length >= pattern.length &&
    subpath.startsWith(wildcard.prefix) &&
    subpath.endsWith(wildcard.suffix)
  );
};

export const winningPackageExportSubpath = (
  subpaths: readonly string[],
  candidate: string,
): string | null => {
  if (subpaths.includes(candidate)) return candidate;
  const winner = subpaths.reduce(
    (best, subpath) =>
      packageExportPatternMatches(subpath, candidate) &&
      packageExportPatternKeyCompare(best, subpath) === 1
        ? subpath
        : best,
    "",
  );
  return winner.length === 0 ? null : winner;
};

export const packageExportTargetPatterns = ({
  depth,
  includeTypes,
  value: exportTarget,
}: {
  readonly depth: number;
  readonly includeTypes: boolean;
  readonly value: unknown;
}): readonly string[] | null => {
  if (typeof exportTarget === "string") return [exportTarget];
  if (exportTarget === null) return [];
  if (depth > EXPORTS_CONDITION_DEPTH_LIMIT || typeof exportTarget !== "object") return null;
  if (Array.isArray(exportTarget)) {
    const nested = exportTarget.map((alternative) =>
      packageExportTargetPatterns({ depth: depth + 1, includeTypes, value: alternative }),
    );
    return nested.some((patterns) => patterns === null)
      ? null
      : nested.flatMap((patterns) => patterns as readonly string[]);
  }
  const nested = Object.entries(exportTarget).flatMap(([condition, branchTarget]) => {
    if ((!includeTypes && /^types(?:@|$)/u.test(condition)) || branchTarget === null) return [];
    return [packageExportTargetPatterns({ depth: depth + 1, includeTypes, value: branchTarget })];
  });
  return nested.some((patterns) => patterns === null)
    ? null
    : nested.flatMap((patterns) => patterns as readonly string[]);
};

export const validPackageExportTargetPattern = (
  packageDirectory: string,
  exportTarget: string,
): boolean => {
  if (!exportTarget.startsWith("./") || singleWildcardPattern(exportTarget) === null) return false;
  return pathIsInside(packageDirectory, resolve(packageDirectory, exportTarget));
};

const captureFromPattern = (pattern: string, candidate: string): string | null => {
  const wildcard = singleWildcardPattern(pattern);
  if (wildcard === null) return null;
  if (!candidate.startsWith(wildcard.prefix) || !candidate.endsWith(wildcard.suffix)) return null;
  const capture = toPosixPath(
    candidate.slice(wildcard.prefix.length, candidate.length - wildcard.suffix.length),
  );
  return capture.length === 0 || capture.includes("*") ? null : capture;
};

export const packageExportPatternCaptures = ({
  packageDirectory,
  repositoryFiles,
  targets,
}: {
  readonly packageDirectory: string;
  readonly repositoryFiles: readonly string[];
  readonly targets: readonly string[];
}): readonly string[] => {
  const candidatePatterns = uniq(
    targets.flatMap((exportTarget) =>
      javaScriptSourceCandidates(resolve(packageDirectory, exportTarget)),
    ),
  );
  return uniq(
    repositoryFiles.flatMap((sourceFile) =>
      candidatePatterns.flatMap((pattern) => {
        const capture = captureFromPattern(pattern, sourceFile);
        return capture === null ? [] : [capture];
      }),
    ),
  ).toSorted();
};

export const substitutePackageExportPattern = (exportTarget: unknown, capture: string): unknown => {
  if (typeof exportTarget === "string") return exportTarget.replace("*", capture);
  if (Array.isArray(exportTarget)) {
    return exportTarget.map((alternative) => substitutePackageExportPattern(alternative, capture));
  }
  if (exportTarget === null || typeof exportTarget !== "object") return exportTarget;
  return Object.fromEntries(
    Object.entries(exportTarget).map(([condition, branchTarget]) => [
      condition,
      substitutePackageExportPattern(branchTarget, capture),
    ]),
  );
};
