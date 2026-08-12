import { dirname, join, resolve } from "node:path";

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

const filesReachableByReExport = (entryFile: string): ReadonlySet<string> => {
  const reached = new Set<string>();
  const visit = (file: string, depth: number): void => {
    if (reached.has(file)) return;
    reached.add(file);
    if (depth >= RE_EXPORT_DEPTH_LIMIT) return;
    const writtenText = readTextFile(file);
    if (writtenText === null) return;
    for (const match of writtenText.matchAll(RE_EXPORT_PATTERN)) {
      const [, specifier] = match;
      const checked = resolveRelativeSpecifier(file, String(specifier));
      if (checked !== null) visit(checked, depth + 1);
    }
  };
  visit(entryFile, 0);
  return reached;
};

const exportSubpathTargets = (
  packageDirectory: string,
  exportsField: unknown,
): ReadonlyMap<string, readonly string[]> => {
  const checkedTargets = new Map<string, string[]>();

  const written = (subpath: string, held: string): void => {
    if (!held.startsWith("./") || held.endsWith(".d.ts")) return;
    const resolved = resolve(packageDirectory, held);
    const bucket = checkedTargets.get(subpath);
    if (bucket === undefined) checkedTargets.set(subpath, [resolved]);
    else if (!bucket.includes(resolved)) bucket.push(resolved);
  };

  const collect = (
    held: unknown,
    { subpath, depth }: { readonly subpath: string; readonly depth: number },
  ): void => {
    if (typeof held === "string") {
      written(subpath, held);
      return;
    }
    if (depth > EXPORTS_CONDITION_DEPTH_LIMIT) return;
    if (held === null || typeof held !== "object" || Array.isArray(held)) return;
    const conditions: readonly (readonly [string, unknown])[] = Object.entries(held);
    for (const [named, nested] of conditions) {
      if (named === `./${MANIFEST_FILE_NAME}`) continue;
      collect(nested, { subpath: named.startsWith(".") ? named : subpath, depth: depth + 1 });
    }
  };

  collect(exportsField, { subpath: ".", depth: 0 });
  return checkedTargets;
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
  const index = new Map<string, string>();
  const surface = manifestSurfaceOf(packageDirectory);
  if (surface === null) return index;

  for (const [subpath, entryFiles] of exportSubpathTargets(
    packageDirectory,
    surface.exportsField,
  )) {
    const specifier = exportSpecifierOf(surface.packageName, subpath);
    for (const entryFile of entryFiles) {
      for (const reached of filesReachableByReExport(entryFile)) {
        if (!index.has(reached)) index.set(reached, specifier);
      }
    }
  }
  return index;
};
