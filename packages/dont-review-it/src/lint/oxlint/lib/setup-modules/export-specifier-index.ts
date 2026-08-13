import { dirname, join, resolve } from "node:path";

import {
  EXPORTS_CONDITION_DEPTH_LIMIT,
  MANIFEST_FILE_NAME,
} from "../canonical-values/package-manifest.ts";
import { readJsonFile } from "../canonical-values/read-json-file.ts";
import { isFile, readTextFile } from "../canonical-values/source-files.ts";

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
    const moduleSource = readTextFile(file);
    if (moduleSource === null) return;
    for (const match of moduleSource.matchAll(RE_EXPORT_PATTERN)) {
      const [, specifier] = match;
      const reExportTarget = resolveRelativeSpecifier(file, String(specifier));
      if (reExportTarget !== null) visit(reExportTarget, depth + 1);
    }
  };
  visit(entryFile, 0);
  return reached;
};

const exportSubpathTargets = (
  packageDirectory: string,
  exportsField: unknown,
): ReadonlyMap<string, readonly string[]> => {
  const targetsBySubpath = new Map<string, string[]>();

  const addExportTarget = (subpath: string, exportTarget: string): void => {
    if (!exportTarget.startsWith("./") || exportTarget.endsWith(".d.ts")) return;
    const resolved = resolve(packageDirectory, exportTarget);
    const bucket = targetsBySubpath.get(subpath);
    if (bucket === undefined) targetsBySubpath.set(subpath, [resolved]);
    else if (!bucket.includes(resolved)) bucket.push(resolved);
  };

  const collect = (
    exportTarget: unknown,
    { subpath, depth }: { readonly subpath: string; readonly depth: number },
  ): void => {
    if (typeof exportTarget === "string") {
      addExportTarget(subpath, exportTarget);
      return;
    }
    if (depth > EXPORTS_CONDITION_DEPTH_LIMIT) return;
    if (exportTarget === null || typeof exportTarget !== "object" || Array.isArray(exportTarget))
      return;
    for (const [conditionName, nested] of Object.entries(exportTarget)) {
      if (conditionName === `./${MANIFEST_FILE_NAME}`) continue;
      collect(nested, {
        subpath: conditionName.startsWith(".") ? conditionName : subpath,
        depth: depth + 1,
      });
    }
  };

  collect(exportsField, { subpath: ".", depth: 0 });
  return targetsBySubpath;
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

export const buildSetupExportSpecifierIndex = (
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
        index.set(reached, index.get(reached) ?? specifier);
      }
    }
  }
  return index;
};
