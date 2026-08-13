import { dirname, join, relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { isRecord } from "../../../../dependency-catalog/record-fields.ts";
import {
  EXPORTS_CONDITION_DEPTH_LIMIT,
  MANIFEST_FILE_NAME,
} from "../canonical-values/package-manifest.ts";
import { readJsonFile } from "../canonical-values/read-json-file.ts";
import { nearestPackageDirectory } from "../canonical-values/source-files.ts";
import { findWorkspaceRoot } from "../canonical-values/workspace-root.ts";
import { toPosixPath } from "../posix-path.ts";

export type PackageSurfaces = {
  readonly packageName: string;
  readonly manifestPath: string;
  readonly runnableFields: readonly string[];
  readonly importableFields: readonly string[];
};

const RUNNABLE_SURFACE_FIELDS: readonly string[] = ["bin"];

const IMPORTABLE_SURFACE_FIELDS: readonly string[] = [
  "exports",
  "main",
  "module",
  "types",
  "typings",
];

const REPOSITORY_ROOT_PACKAGE = ".";

const MANIFEST_SELF_SUBPATH = `./${MANIFEST_FILE_NAME}`;

const declaresTarget = (declared: unknown, depth: number): boolean => {
  if (typeof declared === "string") return declared.trim() !== "";
  if (depth > EXPORTS_CONDITION_DEPTH_LIMIT) return false;
  if (Array.isArray(declared)) return declared.some((nested) => declaresTarget(nested, depth + 1));
  if (!isRecord(declared)) return false;
  return Object.entries(declared).some(
    ([subpath, nested]) => subpath !== MANIFEST_SELF_SUBPATH && declaresTarget(nested, depth + 1),
  );
};

const declaringFieldsOf = (manifest: {
  readonly read: Readonly<Record<string, unknown>>;
  readonly fields: readonly string[];
}): readonly string[] => manifest.fields.filter((field) => declaresTarget(manifest.read[field], 0));

const declaredNameOf = (read: Readonly<Record<string, unknown>>): string | null => {
  const { name } = read;
  return typeof name === "string" && name.trim() !== "" ? name : null;
};

const declaredFieldsAt = memoize(
  (
    packageDirectory: string,
  ): {
    readonly packageName: string | null;
    readonly runnableFields: readonly string[];
    readonly importableFields: readonly string[];
  } | null => {
    const read = readJsonFile(join(packageDirectory, MANIFEST_FILE_NAME));
    if (!isRecord(read)) return null;

    return {
      packageName: declaredNameOf(read),
      runnableFields: declaringFieldsOf({ read, fields: RUNNABLE_SURFACE_FIELDS }),
      importableFields: declaringFieldsOf({ read, fields: IMPORTABLE_SURFACE_FIELDS }),
    };
  },
);

const withinRepository = (location: {
  readonly repositoryRoot: string;
  readonly path: string;
}): string => {
  const within = toPosixPath(relative(location.repositoryRoot, location.path));
  return within === "" ? REPOSITORY_ROOT_PACKAGE : within;
};

export const governingSurfacesOf = (source: {
  readonly cwd: string;
  readonly filename: string;
}): PackageSurfaces | null => {
  const fileDirectory = dirname(resolve(source.cwd, source.filename));
  const repositoryRoot = findWorkspaceRoot(fileDirectory);
  const packageDirectory = nearestPackageDirectory(fileDirectory, repositoryRoot);
  if (packageDirectory === null) return null;

  const declared = declaredFieldsAt(packageDirectory);
  if (declared === null) return null;

  return {
    packageName:
      declared.packageName ?? withinRepository({ repositoryRoot, path: packageDirectory }),
    manifestPath: withinRepository({
      repositoryRoot,
      path: join(packageDirectory, MANIFEST_FILE_NAME),
    }),
    runnableFields: declared.runnableFields,
    importableFields: declared.importableFields,
  };
};
