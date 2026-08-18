import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isPlainObject } from "es-toolkit";

import { readUnlessMissing } from "./path-failure.ts";

export type NormativeDocumentPlaces = {
  readonly fileName: string;
  readonly directories: readonly string[];
};

const WITHOUT_A_DECLARATION: NormativeDocumentPlaces = {
  fileName: "AGENTS.md",
  directories: [],
};

const declaredIn = (repositoryRoot: string): Record<string, unknown> | null => {
  const MANIFEST_FILE = "package.json";
  const manifestText = readUnlessMissing(() =>
    readFileSync(join(repositoryRoot, MANIFEST_FILE), "utf8"),
  );

  const manifest: unknown = manifestText === null ? null : JSON.parse(manifestText);
  if (!isPlainObject(manifest)) return null;

  const DECLARATION_FIELD = "normativeDocuments";
  const declared: unknown = manifest[DECLARATION_FIELD];
  return isPlainObject(declared) ? declared : null;
};

export const normativeDocumentPlacesIn = (repositoryRoot: string): NormativeDocumentPlaces => {
  const declared = declaredIn(repositoryRoot);
  if (declared === null) return WITHOUT_A_DECLARATION;

  const spelledName: unknown = declared.fileName;
  const spelledDirectories: unknown = declared.directories;

  return {
    fileName: typeof spelledName === "string" ? spelledName : WITHOUT_A_DECLARATION.fileName,
    directories: Array.isArray(spelledDirectories)
      ? spelledDirectories.filter((directory): directory is string => typeof directory === "string")
      : WITHOUT_A_DECLARATION.directories,
  };
};

export const DOCUMENT_SUFFIX = ".md";

const documentsDirectlyIn = ({
  repositoryRoot,
  directory,
}: {
  readonly repositoryRoot: string;
  readonly directory: string;
}): readonly string[] => {
  const listedEntries = readUnlessMissing(() =>
    readdirSync(join(repositoryRoot, directory), { withFileTypes: true }),
  );

  return (listedEntries ?? [])
    .filter(
      (listed) =>
        listed.isFile() && !listed.isSymbolicLink() && listed.name.endsWith(DOCUMENT_SUFFIX),
    )
    .map((listed) => `${directory}/${listed.name}`);
};

export const normativeDocumentsIn = ({
  repositoryRoot,
  places,
  workspaceDirectories,
}: {
  readonly repositoryRoot: string;
  readonly places: NormativeDocumentPlaces;
  readonly workspaceDirectories: readonly string[];
}): readonly string[] =>
  places.directories
    .flatMap((directory) => [directory, ...workspaceDirectories.map((one) => join(one, directory))])
    .flatMap((directory) => documentsDirectlyIn({ repositoryRoot, directory }))
    .toSorted();
