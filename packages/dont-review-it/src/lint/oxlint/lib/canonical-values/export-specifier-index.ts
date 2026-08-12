import { dirname, join, resolve } from "node:path";

import { groupBy, uniq, uniqBy } from "es-toolkit";

import { EXPORTS_CONDITION_DEPTH_LIMIT, MANIFEST_FILE_NAME } from "./package-manifest.ts";
import { readJsonFile } from "./read-json-file.ts";
import { isFile, readTextFile } from "./source-files.ts";

const RE_EXPORT_DEPTH_LIMIT = 4;

const RELATIVE_SPECIFIER_PATTERN = /^\.\.?\//u;

const RE_EXPORT_PATTERN =
  /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/gu;

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

const filesReachedFrom = (
  file: string,
  { depth, walked }: { readonly depth: number; readonly walked: readonly string[] },
): readonly string[] => {
  if (walked.includes(file)) return walked;
  const opened = [...walked, file];
  if (depth >= RE_EXPORT_DEPTH_LIMIT) return opened;
  const text = readTextFile(file);
  if (text === null) return opened;

  return [...text.matchAll(RE_EXPORT_PATTERN)].reduce<readonly string[]>((reached, match) => {
    const [, specifier] = match;
    const target = resolveRelativeSpecifier(file, String(specifier));
    return target === null
      ? reached
      : filesReachedFrom(target, { depth: depth + 1, walked: reached });
  }, opened);
};

const filesReachableByReExport = (entryFile: string): readonly string[] =>
  filesReachedFrom(entryFile, { depth: 0, walked: [] });

const exportSubpathReaches = (
  declared: unknown,
  {
    packageDirectory,
    subpath,
    depth,
  }: { readonly packageDirectory: string; readonly subpath: string; readonly depth: number },
): readonly { readonly subpath: string; readonly target: string }[] => {
  if (typeof declared === "string") {
    if (!declared.startsWith("./") || declared.endsWith(".d.ts")) return [];
    return [{ subpath, target: resolve(packageDirectory, declared) }];
  }
  if (depth > EXPORTS_CONDITION_DEPTH_LIMIT) return [];
  if (declared === null || typeof declared !== "object" || Array.isArray(declared)) return [];

  const conditions: readonly (readonly [string, unknown])[] = Object.entries(declared);
  return conditions
    .filter(([key]) => key !== `./${MANIFEST_FILE_NAME}`)
    .flatMap(([key, nested]) =>
      exportSubpathReaches(nested, {
        packageDirectory,
        subpath: key.startsWith(".") ? key : subpath,
        depth: depth + 1,
      }),
    );
};

const exportSubpathTargets = (
  packageDirectory: string,
  exportsField: unknown,
): ReadonlyMap<string, readonly string[]> => {
  const reaches = exportSubpathReaches(exportsField, { packageDirectory, subpath: ".", depth: 0 });

  return new Map(
    Object.entries(groupBy(reaches, (reach) => reach.subpath)).map(([subpath, grouped]) => [
      subpath,
      uniq(grouped.map((reach) => reach.target)),
    ]),
  );
};

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

export const buildExportSpecifierIndex = (
  packageDirectory: string,
): ReadonlyMap<string, string> => {
  const surface = manifestSurfaceOf(packageDirectory);
  if (surface === null) return new Map();

  const entryReaches = [...exportSubpathTargets(packageDirectory, surface.exportsField)].flatMap(
    ([subpath, entryFiles]) => entryFiles.map((entryFile) => ({ subpath, entryFile })),
  );

  const reached = entryReaches.flatMap((reach) =>
    filesReachableByReExport(reach.entryFile).map((file): readonly [string, string] => [
      file,
      exportSpecifierOf(surface.packageName, reach.subpath),
    ]),
  );

  return new Map(uniqBy(reached, ([file]) => file));
};
