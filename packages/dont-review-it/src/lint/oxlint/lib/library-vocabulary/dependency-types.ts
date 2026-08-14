import { join } from "node:path";

import { sortBy } from "es-toolkit";

import {
  EXPORTS_CONDITION_DEPTH_LIMIT,
  MANIFEST_FILE_NAME,
} from "../canonical-values/package-manifest.ts";
import { readJsonFile } from "../canonical-values/read-json-file.ts";
import { isFile } from "../canonical-values/source-files.ts";

export type DependencyTypeEntry = {
  readonly packageName: string;
  readonly declarationsPath: string;
};

const WORKSPACE_PROTOCOL = "workspace:";

const NODE_MODULES_DIRECTORY_NAME = "node_modules";

const isRecord = (held: unknown): held is Record<string, unknown> =>
  held !== null && typeof held === "object" && !Array.isArray(held);

const recordFieldOf = (
  manifest: Record<string, unknown>,
  field: string,
): Record<string, unknown> => {
  const declared = manifest[field];
  return isRecord(declared) ? declared : {};
};

const ROOT_SUBPATH = ".";

const rootExportsOf = (exportsField: unknown): unknown => {
  if (typeof exportsField === "string") return exportsField;
  if (!isRecord(exportsField)) return null;
  const subpaths = Object.entries(exportsField);
  const root = subpaths.find(([subpath]) => subpath === ROOT_SUBPATH);
  if (root !== undefined) return root[1];
  return subpaths.some(([subpath]) => subpath.startsWith(ROOT_SUBPATH)) ? null : exportsField;
};

const TYPES_CONDITION = "types";

const typesConditionIn = (held: unknown, depth: number): string | null => {
  if (!isRecord(held) || depth > EXPORTS_CONDITION_DEPTH_LIMIT) return null;
  const conditions = Object.entries(held);
  const declared = conditions.find(
    ([condition, checked]) => condition === TYPES_CONDITION && typeof checked === "string",
  );
  if (declared !== undefined) return String(declared[1]);
  for (const [, nested] of conditions) {
    const found = typesConditionIn(nested, depth + 1);
    if (found !== null) return found;
  }
  return null;
};

const anyConditionIn = (held: unknown, depth: number): string | null => {
  if (typeof held === "string") return held;
  if (!isRecord(held) || depth > EXPORTS_CONDITION_DEPTH_LIMIT) return null;
  for (const [, nested] of Object.entries(held)) {
    const found = anyConditionIn(nested, depth + 1);
    if (found !== null) return found;
  }
  return null;
};

const stringFieldOf = (manifest: Record<string, unknown>, field: string): string | null => {
  const declared = manifest[field];
  return typeof declared === "string" ? declared : null;
};

const entryPathsOf = (manifest: Record<string, unknown>): readonly string[] => {
  const rootExports = rootExportsOf(manifest.exports);
  return [
    typesConditionIn(rootExports, 0),
    anyConditionIn(rootExports, 0),
    stringFieldOf(manifest, TYPES_CONDITION),
    stringFieldOf(manifest, "typings"),
    stringFieldOf(manifest, "main"),
  ].filter((path): path is string => path !== null);
};

const DECLARATIONS_SUFFIX_PATTERN = /\.[cm]?tsx?$/u;

const SCRIPT_SUFFIX_PATTERN = /\.([cm]?)js$/u;

const declarationsCandidateFor = (entryPath: string): string | null => {
  if (DECLARATIONS_SUFFIX_PATTERN.test(entryPath)) return entryPath;
  if (!SCRIPT_SUFFIX_PATTERN.test(entryPath)) return null;
  return entryPath.replace(SCRIPT_SUFFIX_PATTERN, ".d.$1ts");
};

const declarationsOf = (dependencyDirectory: string): string | null => {
  const manifest = readJsonFile(join(dependencyDirectory, MANIFEST_FILE_NAME));
  if (!isRecord(manifest)) return null;
  for (const entryPath of entryPathsOf(manifest)) {
    const candidate = declarationsCandidateFor(entryPath);
    if (candidate === null) continue;
    const resolved = join(dependencyDirectory, candidate);
    if (isFile(resolved)) return resolved;
  }
  return null;
};

export const dependencyTypeEntries = (packageDirectory: string): readonly DependencyTypeEntry[] => {
  const manifest = readJsonFile(join(packageDirectory, MANIFEST_FILE_NAME));
  if (!isRecord(manifest)) return [];

  const specifiers = {
    ...recordFieldOf(manifest, "dependencies"),
    ...recordFieldOf(manifest, "devDependencies"),
    ...recordFieldOf(manifest, "peerDependencies"),
  };

  const listedEntries = Object.entries(specifiers).flatMap(([packageName, range]) => {
    if (typeof range === "string" && range.startsWith(WORKSPACE_PROTOCOL)) return [];
    const declarationsPath = declarationsOf(
      join(packageDirectory, NODE_MODULES_DIRECTORY_NAME, packageName),
    );
    return declarationsPath === null ? [] : [{ packageName, declarationsPath }];
  });

  return sortBy(listedEntries, ["packageName"]);
};
