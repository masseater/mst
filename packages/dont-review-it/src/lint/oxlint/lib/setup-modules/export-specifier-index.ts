import { dirname, join, resolve } from "node:path";

import { groupBy, uniq, uniqBy } from "es-toolkit";

import {
  EXPORTS_CONDITION_DEPTH_LIMIT,
  MANIFEST_FILE_NAME,
} from "../canonical-values/package-manifest.ts";
import { readJsonFile } from "../canonical-values/read-json-file.ts";
import { isFile, readTextFile } from "../canonical-values/source-files.ts";

const subpathTargetPairsOf = (
  exportTarget: unknown,
  {
    packageDirectory,
    subpath,
    depth,
  }: { readonly packageDirectory: string; readonly subpath: string; readonly depth: number },
): readonly (readonly [string, string])[] => {
  if (typeof exportTarget === "string") {
    if (!exportTarget.startsWith("./") || exportTarget.endsWith(".d.ts")) return [];
    return [[subpath, resolve(packageDirectory, exportTarget)]];
  }
  if (depth > EXPORTS_CONDITION_DEPTH_LIMIT) return [];
  if (exportTarget === null || typeof exportTarget !== "object" || Array.isArray(exportTarget)) {
    return [];
  }
  return Object.entries(exportTarget)
    .filter(([conditionName]) => conditionName !== `./${MANIFEST_FILE_NAME}`)
    .flatMap(([conditionName, nestedTarget]) =>
      subpathTargetPairsOf(nestedTarget, {
        packageDirectory,
        subpath: conditionName.startsWith(".") ? conditionName : subpath,
        depth: depth + 1,
      }),
    );
};

const exportSubpathTargets = (
  packageDirectory: string,
  exportsField: unknown,
): ReadonlyMap<string, readonly string[]> =>
  new Map(
    Object.entries(
      groupBy(
        subpathTargetPairsOf(exportsField, { packageDirectory, subpath: ".", depth: 0 }),
        ([subpath]) => subpath,
      ),
    ).map(([subpath, pairsOfSubpath]) => [
      subpath,
      uniq(pairsOfSubpath.map(([, resolvedTarget]) => resolvedTarget)),
    ]),
  );

const exportSpecifierOf = (packageName: string, subpath: string): string =>
  subpath === "." ? packageName : `${packageName}${subpath.slice(1)}`;

const manifestSurfaceOf = (
  packageDirectory: string,
): { readonly packageName: string; readonly exportsField: unknown } | null => {
  const manifest = readJsonFile(join(packageDirectory, MANIFEST_FILE_NAME));
  if (manifest === null || typeof manifest !== "object") return null;
  if (!("name" in manifest) || typeof manifest.name !== "string" || manifest.name.length === 0) {
    return null;
  }
  return {
    packageName: manifest.name,
    exportsField: "exports" in manifest ? manifest.exports : undefined,
  };
};

const RE_EXPORT_DEPTH_LIMIT = 4;

const RE_EXPORT_PATTERN =
  /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/gu;

const RELATIVE_SPECIFIER_PATTERN = /^\.\.?\//u;

const resolveRelativeSpecifier = (fromFile: string, specifier: string): string | null => {
  if (!RELATIVE_SPECIFIER_PATTERN.test(specifier)) return null;
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base,
    base.replace(/\.js$/u, ".ts"),
    base.replace(/\.mjs$/u, ".mts"),
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  return candidates.find(isFile) ?? null;
};

const reExportTargetsOf = (file: string): readonly string[] => {
  const moduleSource = readTextFile(file);
  if (moduleSource === null) return [];
  return [...moduleSource.matchAll(RE_EXPORT_PATTERN)].flatMap(
    ([, specifier]) => resolveRelativeSpecifier(file, String(specifier)) ?? [],
  );
};

const filesReachableByReExport = (entryFile: string): ReadonlySet<string> => {
  const walk = (
    file: string,
    {
      depth,
      reachedBefore,
    }: { readonly depth: number; readonly reachedBefore: ReadonlySet<string> },
  ): ReadonlySet<string> => {
    if (reachedBefore.has(file)) return reachedBefore;
    const reachedWithFile: ReadonlySet<string> = new Set([...reachedBefore, file]);
    if (depth >= RE_EXPORT_DEPTH_LIMIT) return reachedWithFile;
    return reExportTargetsOf(file).reduce(
      (reachedByEarlierTargets, reExportTarget) =>
        walk(reExportTarget, { depth: depth + 1, reachedBefore: reachedByEarlierTargets }),
      reachedWithFile,
    );
  };
  return walk(entryFile, { depth: 0, reachedBefore: new Set() });
};

const reachedFilePairsUnder = (
  entryFiles: readonly string[],
  specifier: string,
): readonly (readonly [string, string])[] =>
  entryFiles.flatMap((entryFile) =>
    [...filesReachableByReExport(entryFile)].map((reachedFile): readonly [string, string] => [
      reachedFile,
      specifier,
    ]),
  );

export const buildSetupExportSpecifierIndex = (
  packageDirectory: string,
): ReadonlyMap<string, string> => {
  const surface = manifestSurfaceOf(packageDirectory);
  if (surface === null) return new Map<string, string>();

  const reachedFileSpecifierPairs = [
    ...exportSubpathTargets(packageDirectory, surface.exportsField),
  ].flatMap(([subpath, entryFiles]) =>
    reachedFilePairsUnder(entryFiles, exportSpecifierOf(surface.packageName, subpath)),
  );
  return new Map(uniqBy(reachedFileSpecifierPairs, ([reachedFile]) => reachedFile));
};
