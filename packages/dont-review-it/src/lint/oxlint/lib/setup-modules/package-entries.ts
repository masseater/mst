import { dirname, join, resolve } from "node:path";

import { matchesGlobSegment } from "@mst/lint-rule-authoring";
import { zip } from "es-toolkit";

import {
  EXPORTS_CONDITION_DEPTH_LIMIT,
  MANIFEST_FILE_NAME,
} from "../canonical-values/package-manifest.ts";
import { readJsonFile } from "../canonical-values/read-json-file.ts";
import { isFile } from "../canonical-values/source-files.ts";
import { segmentsOf } from "../path-segments.ts";
import { toPosixPath } from "../posix-path.ts";

const MODULE_FILE_NAME = /\.[cm]?[jt]sx?$/u;

const RELATIVE_TARGET_PREFIX = "./";

type DeclaredEntry = {
  readonly subpath: string;
  readonly target: string;
};

const manifestOf = (packageDirectory: string): Readonly<Record<string, unknown>> | null => {
  const read = readJsonFile(join(packageDirectory, MANIFEST_FILE_NAME));
  if (read === null || typeof read !== "object" || Array.isArray(read)) return null;
  return read as Readonly<Record<string, unknown>>;
};

const entriesUnder = (
  held: unknown,
  { subpath, depth }: { readonly subpath: string; readonly depth: number },
): readonly DeclaredEntry[] => {
  if (typeof held === "string") {
    return held.startsWith(RELATIVE_TARGET_PREFIX) ? [{ subpath, target: held }] : [];
  }
  if (depth > EXPORTS_CONDITION_DEPTH_LIMIT || held === null || typeof held !== "object") {
    return [];
  }
  if (Array.isArray(held)) {
    return held.flatMap((nested) => entriesUnder(nested, { subpath, depth: depth + 1 }));
  }
  return Object.entries(held).flatMap(([named, nested]) =>
    entriesUnder(nested, {
      subpath: named.startsWith(".") ? named : subpath,
      depth: depth + 1,
    }),
  );
};

const runnableEntriesOf = (manifest: Readonly<Record<string, unknown>>): readonly DeclaredEntry[] =>
  entriesUnder(manifest.bin, { subpath: ".", depth: 0 });

const importableEntriesOf = (
  manifest: Readonly<Record<string, unknown>>,
): readonly DeclaredEntry[] => [
  ...entriesUnder(manifest.exports, { subpath: ".", depth: 0 }),
  ...entriesUnder(manifest.main, { subpath: ".", depth: 0 }),
];

const declaredEntriesOf = (packageDirectory: string): readonly DeclaredEntry[] => {
  const manifest = manifestOf(packageDirectory);
  if (manifest === null) return [];
  return [...importableEntriesOf(manifest), ...runnableEntriesOf(manifest)];
};

const isModuleFile = (path: string): boolean => MODULE_FILE_NAME.test(path) && isFile(path);

export const publicEntryFilesOf = (packageDirectory: string): readonly string[] | null => {
  const declared = declaredEntriesOf(packageDirectory);
  if (declared.length === 0) return null;

  const files = declared
    .map((listed) => resolve(packageDirectory, listed.target))
    .filter(isModuleFile);
  return files.length === 0 ? null : [...new Set(files)];
};

const matchesSubpath = (declared: string, requested: string): boolean => {
  const declaredSegments = segmentsOf({ path: declared, separator: "/" });
  const requestedSegments = segmentsOf({ path: requested, separator: "/" });
  if (declaredSegments.length !== requestedSegments.length) return false;
  return zip(declaredSegments, requestedSegments).every(([pattern, segment]) =>
    matchesGlobSegment({ segment, pattern }),
  );
};

export const declaresPublicSubpath = ({
  packageDirectory,
  subpath,
}: {
  readonly packageDirectory: string;
  readonly subpath: string;
}): boolean => {
  const manifest = manifestOf(packageDirectory);
  if (manifest === null) return false;

  const declared = importableEntriesOf(manifest).map((listed) => listed.subpath);
  if (subpath === ".") return declared.includes(".");
  return declared.some((spelled) => matchesSubpath(spelled, subpath));
};

export const owningPackageDirectoryOf = (file: string): string | null => {
  const directory = dirname(file);
  if (isFile(join(directory, MANIFEST_FILE_NAME))) return directory;

  const parent = dirname(directory);
  return parent === directory ? null : owningPackageDirectoryOf(directory);
};

export const isInsideDirectory = ({
  path,
  directory,
}: {
  readonly path: string;
  readonly directory: string;
}): boolean => toPosixPath(path).startsWith(`${toPosixPath(directory)}/`);
