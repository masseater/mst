import { dirname, isAbsolute, resolve } from "node:path";

import { pathIsInside } from "../path-is-inside.ts";
import { isRelativeImportSpecifier } from "./import-specifier.ts";
import { readJsonFile } from "./read-json-file.ts";
import { isFile, listRepositoryFiles } from "./source-files.ts";
import {
  resolveViteAlias,
  resolveViteExtensions,
  resolveViteMainFields,
  resolveVitePublicDirectories,
  resolveViteRoots,
} from "./vite-alias-resolution.ts";

type ViteRepositoryQuery = {
  readonly containingFile: string;
  readonly repositoryRoot: string;
  readonly specifier: string;
};

const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
  candidate !== null && typeof candidate === "object" && !Array.isArray(candidate);

const fileWithExtensions = (basePath: string, extensions: readonly string[]): string | null => {
  if (isFile(basePath)) return basePath;
  return extensions.map((extension) => `${basePath}${extension}`).find(isFile) ?? null;
};

const aliasedFile = (query: ViteRepositoryQuery, extensions: readonly string[]): string | null => {
  const aliased = resolveViteAlias(query);
  if (aliased === null) return null;
  const absolute = isAbsolute(aliased) ? aliased : resolve(query.repositoryRoot, aliased);
  return fileWithExtensions(absolute, extensions);
};

const directFile = (query: ViteRepositoryQuery, extensions: readonly string[]): string | null => {
  if (isRelativeImportSpecifier(query.specifier)) {
    return fileWithExtensions(resolve(dirname(query.containingFile), query.specifier), extensions);
  }
  if (isAbsolute(query.specifier) && pathIsInside(query.repositoryRoot, query.specifier)) {
    return fileWithExtensions(query.specifier, extensions);
  }
  if (!query.specifier.startsWith("/")) return null;
  return (
    resolveViteRoots(query.repositoryRoot)
      .map((root) => fileWithExtensions(resolve(root, query.specifier.slice(1)), extensions))
      .find((path) => path !== null) ?? null
  );
};

const packageNameOf = (specifier: string): string | null => {
  const segments = specifier.split("/");
  if (specifier.startsWith("@")) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
  }
  return segments[0] === "" ? null : (segments[0] ?? null);
};

const manifestMainField = (input: {
  readonly fields: readonly string[];
  readonly manifestPath: string;
  readonly packageName: string;
}): string | null => {
  const manifest = readJsonFile(input.manifestPath);
  if (!isRecord(manifest) || manifest.name !== input.packageName) return null;
  for (const field of input.fields) {
    const candidate = manifest[field];
    if (typeof candidate === "string") return candidate;
  }
  return null;
};

const mainFieldFile = (
  query: ViteRepositoryQuery,
  extensions: readonly string[],
): string | null => {
  const packageName = packageNameOf(query.specifier);
  const fields = resolveViteMainFields(query.repositoryRoot);
  if (packageName === null || query.specifier !== packageName || fields.length === 0) return null;
  for (const manifest of listRepositoryFiles(query.repositoryRoot).manifests) {
    const entry = manifestMainField({ fields, manifestPath: manifest.absolutePath, packageName });
    if (entry === null) continue;
    const resolved = fileWithExtensions(resolve(dirname(manifest.absolutePath), entry), extensions);
    if (resolved !== null) return resolved;
  }
  return null;
};

export const resolveViteRepositorySpecifier = (query: ViteRepositoryQuery): string | null => {
  const extensions = resolveViteExtensions(query.repositoryRoot);
  return (
    aliasedFile(query, extensions) ??
    directFile(query, extensions) ??
    mainFieldFile(query, extensions)
  );
};

export const resolveVitePublicSpecifier = (input: {
  readonly repositoryRoot: string;
  readonly specifier: string;
}): string | null => {
  if (!input.specifier.startsWith("/") || input.specifier.startsWith("//")) return null;
  return (
    resolveVitePublicDirectories(input.repositoryRoot)
      .map((directory) => resolve(directory, input.specifier.slice(1)))
      .find(isFile) ?? null
  );
};
