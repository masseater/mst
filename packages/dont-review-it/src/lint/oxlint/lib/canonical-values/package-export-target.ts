import { join, resolve } from "node:path";

import { uniq } from "es-toolkit";

import { pathIsInside } from "../path-is-inside.ts";
import { toPosixPath } from "../posix-path.ts";
import { EXPORTS_CONDITION_DEPTH_LIMIT } from "./package-manifest.ts";
import { isFile } from "./source-files.ts";

const javaScriptSourceCandidates = (target: string): readonly string[] =>
  uniq([
    target.replace(/\.js$/u, ".ts"),
    target.replace(/\.jsx$/u, ".tsx"),
    target.replace(/\.mjs$/u, ".mts"),
    target.replace(/\.cjs$/u, ".cts"),
    target,
  ]);

const targetCandidates = (packageDirectory: string, target: string): readonly string[] => {
  const base = resolve(packageDirectory, target);
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

export const packageExportSourceFile = (packageDirectory: string, target: string): string | null =>
  targetCandidates(packageDirectory, target).find(isFile) ?? null;

export const singleWildcardPattern = (
  value: string,
): { readonly prefix: string; readonly suffix: string } | null => {
  const wildcard = value.indexOf("*");
  if (wildcard === -1 || value.includes("*", wildcard + 1)) return null;
  return { prefix: value.slice(0, wildcard), suffix: value.slice(wildcard + 1) };
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
  value,
}: {
  readonly depth: number;
  readonly includeTypes: boolean;
  readonly value: unknown;
}): readonly string[] | null => {
  if (typeof value === "string") return [value];
  if (value === null) return [];
  if (depth > EXPORTS_CONDITION_DEPTH_LIMIT || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    const nested = value.map((item) =>
      packageExportTargetPatterns({ depth: depth + 1, includeTypes, value: item }),
    );
    return nested.some((patterns) => patterns === null)
      ? null
      : nested.flatMap((patterns) => patterns as readonly string[]);
  }
  const nested = Object.entries(value).flatMap(([condition, target]) => {
    if ((!includeTypes && /^types(?:@|$)/u.test(condition)) || target === null) return [];
    return [packageExportTargetPatterns({ depth: depth + 1, includeTypes, value: target })];
  });
  return nested.some((patterns) => patterns === null)
    ? null
    : nested.flatMap((patterns) => patterns as readonly string[]);
};

export const validPackageExportTargetPattern = (
  packageDirectory: string,
  target: string,
): boolean => {
  if (!target.startsWith("./") || singleWildcardPattern(target) === null) return false;
  return pathIsInside(packageDirectory, resolve(packageDirectory, target));
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
    targets.flatMap((target) => javaScriptSourceCandidates(resolve(packageDirectory, target))),
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

export const substitutePackageExportPattern = (value: unknown, capture: string): unknown => {
  if (typeof value === "string") return value.replace("*", capture);
  if (Array.isArray(value)) {
    return value.map((item) => substitutePackageExportPattern(item, capture));
  }
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([condition, target]) => [
      condition,
      substitutePackageExportPattern(target, capture),
    ]),
  );
};
