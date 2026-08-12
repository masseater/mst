import { realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { buildExportSpecifierIndex } from "../canonical-values/export-specifier-index.ts";
import { isDirectory, isFile } from "../canonical-values/source-files.ts";
import { readUnlessMissing } from "../path-failure.ts";
import { segmentsOf } from "../path-segments.ts";
import { toPosixPath } from "../posix-path.ts";
import { aliasedPathsFor } from "../tsconfig-path-aliases.ts";
import { declaresPublicSubpath, isInsideDirectory } from "./package-entries.ts";

const SCOPE_PREFIX = "@";

const MODULE_SUFFIXES: readonly string[] = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

const REWRITTEN_SUFFIXES: readonly (readonly [RegExp, string])[] = [
  [/\.js$/u, ".ts"],
  [/\.jsx$/u, ".tsx"],
  [/\.mjs$/u, ".mts"],
  [/\.cjs$/u, ".cts"],
];

export type ResolvedModule =
  | { readonly kind: "repositoryFile"; readonly path: string }
  | { readonly kind: "publicEntry"; readonly packageDirectory: string };

const candidatePathsFor = (base: string): readonly string[] => [
  base,
  ...REWRITTEN_SUFFIXES.map(([written, source]) => base.replace(written, source)),
  ...MODULE_SUFFIXES.map((suffix) => `${base}${suffix}`),
  ...MODULE_SUFFIXES.map((suffix) => join(base, `index${suffix}`)),
];

const existingModuleAt = (base: string): ResolvedModule | null => {
  const found = candidatePathsFor(base).find(isFile);
  return found === undefined ? null : { kind: "repositoryFile", path: found };
};

export const packageReferenceOf = (
  specifier: string,
): { readonly name: string; readonly subpath: string } | null => {
  const segments = segmentsOf({ path: specifier, separator: "/" });
  const takenSegments = specifier.startsWith(SCOPE_PREFIX) ? 2 : 1;
  if (segments.length < takenSegments) return null;

  const trailing = segments.slice(takenSegments);
  return {
    name: segments.slice(0, takenSegments).join("/"),
    subpath: trailing.length === 0 ? "." : `./${trailing.join("/")}`,
  };
};

const realPathOf = (path: string): string | null => readUnlessMissing(() => realpathSync(path));

const installedPackageDirectory = (fromDirectory: string, packageName: string): string | null => {
  const candidate = join(fromDirectory, "node_modules", packageName);
  if (isDirectory(candidate)) return realPathOf(candidate);

  const parent = dirname(fromDirectory);
  return parent === fromDirectory ? null : installedPackageDirectory(parent, packageName);
};

const isInstalledCopy = (path: string): boolean =>
  segmentsOf({ path: toPosixPath(path), separator: "/" }).includes("node_modules");

export const packageDirectoryInWorkspace = ({
  specifier,
  fromFile,
  workspaceRoot,
}: {
  readonly specifier: string;
  readonly fromFile: string;
  readonly workspaceRoot: string;
}): { readonly directory: string; readonly subpath: string } | null => {
  const reference = packageReferenceOf(specifier);
  if (reference === null) return null;

  const directory = installedPackageDirectory(dirname(fromFile), reference.name);
  if (directory === null || isInstalledCopy(directory)) return null;
  if (!isInsideDirectory({ path: directory, directory: workspaceRoot })) return null;
  return { directory, subpath: reference.subpath };
};

export const resolveCoupling = ({
  specifier,
  fromFile,
  workspaceRoot,
}: {
  readonly specifier: string;
  readonly fromFile: string;
  readonly workspaceRoot: string;
}): ResolvedModule | null => {
  if (specifier.startsWith("#") || isAbsolute(specifier)) return null;
  if (/^\.\.?\//u.test(specifier)) {
    return existingModuleAt(resolve(dirname(fromFile), specifier));
  }

  const found = packageDirectoryInWorkspace({ specifier, fromFile, workspaceRoot });
  if (found === null) return null;
  if (declaresPublicSubpath({ packageDirectory: found.directory, subpath: found.subpath })) {
    return { kind: "publicEntry", packageDirectory: found.directory };
  }
  return existingModuleAt(join(found.directory, found.subpath));
};

export type CouplingRequest = {
  readonly specifier: string;
  readonly fromFile: string;
  readonly workspaceRoot: string;
};

const rememberedIndexOf = memoize(buildExportSpecifierIndex);

const entryFilesUnder = (packageDirectory: string, specifier: string): readonly string[] =>
  [...rememberedIndexOf(packageDirectory)]
    .filter(([, spelled]) => spelled === specifier)
    .map(([file]) => file);

export const relativeSpecifierTo = (fromFile: string, target: string): string => {
  const spelled = toPosixPath(relative(dirname(fromFile), target));
  return spelled.startsWith(".") ? spelled : `./${spelled}`;
};

const aliasedFilesFor = (request: CouplingRequest): readonly string[] =>
  aliasedPathsFor({ specifier: request.specifier, fromFile: request.fromFile }).flatMap((path) => {
    const resolved = resolveCoupling({
      specifier: relativeSpecifierTo(request.fromFile, path),
      fromFile: request.fromFile,
      workspaceRoot: request.workspaceRoot,
    });
    return resolved?.kind === "repositoryFile" ? [resolved.path] : [];
  });

export const repositoryFilesFor = (request: CouplingRequest): readonly string[] => {
  const { specifier, fromFile, workspaceRoot } = request;
  const resolved = resolveCoupling({ specifier, fromFile, workspaceRoot });
  if (resolved?.kind === "repositoryFile") return [resolved.path];

  const found = packageDirectoryInWorkspace({ specifier, fromFile, workspaceRoot });
  return found === null ? aliasedFilesFor(request) : entryFilesUnder(found.directory, specifier);
};
