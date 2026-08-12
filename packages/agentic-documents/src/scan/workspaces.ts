import { join } from "node:path";

import { parse } from "yaml";

import {
  directoryNamesIn,
  nonEmptyStringOrNull,
  readJsonObjectOrNull,
  readTextOrNull,
} from "./read-file.ts";

export type WorkspaceEntry = {
  readonly directory: string;
  readonly description: string;
};

type IncompleteWorkspace = {
  readonly directory: string;
  readonly reason: string;
};

export type WorkspaceCollection = {
  readonly entries: readonly WorkspaceEntry[];
  readonly incomplete: readonly IncompleteWorkspace[];
};

const expandPattern = async ({
  repositoryRoot,
  pattern,
}: {
  readonly repositoryRoot: string;
  readonly pattern: string;
}): Promise<readonly string[]> => {
  if (!pattern.endsWith("/*")) return [pattern];

  const parentDirectory = pattern.slice(0, -2);
  const spelledNames = await directoryNamesIn(join(repositoryRoot, parentDirectory));

  return spelledNames.map((spelled) => `${parentDirectory}/${spelled}`);
};

const declaredWorkspaceDirectories = async ({
  repositoryRoot,
  definitionFile,
  definitionField,
}: {
  readonly repositoryRoot: string;
  readonly definitionFile: string;
  readonly definitionField: string;
}): Promise<readonly string[]> => {
  const raw = await readTextOrNull(join(repositoryRoot, definitionFile));
  if (raw === null) return [];

  const parsedNode: unknown = parse(raw);
  if (typeof parsedNode !== "object" || parsedNode === null) return [];

  const patterns = (parsedNode as Record<string, unknown>)[definitionField];
  if (!Array.isArray(patterns)) return [];

  const expanded = await Promise.all(
    patterns
      .filter((pattern): pattern is string => typeof pattern === "string")
      .map((pattern) => expandPattern({ repositoryRoot, pattern })),
  );

  return expanded.flat().toSorted();
};

const workspaceAt = async ({
  repositoryRoot,
  directory,
}: {
  readonly repositoryRoot: string;
  readonly directory: string;
}): Promise<WorkspaceEntry | IncompleteWorkspace> => {
  const manifest = await readJsonObjectOrNull(join(repositoryRoot, directory, "package.json"));
  if (manifest === null) return { directory, reason: "マニフェストが無いか読めない" };

  const description = nonEmptyStringOrNull(manifest.description);
  if (description === null) return { directory, reason: "マニフェストに説明が無い" };

  return { directory, description };
};

export const collectWorkspaces = async ({
  repositoryRoot,
  definitionFile,
  definitionField,
}: {
  readonly repositoryRoot: string;
  readonly definitionFile: string;
  readonly definitionField: string;
}): Promise<WorkspaceCollection> => {
  const directories = await declaredWorkspaceDirectories({
    repositoryRoot,
    definitionFile,
    definitionField,
  });

  const resolved = await Promise.all(
    directories.map((directory) => workspaceAt({ repositoryRoot, directory })),
  );

  return {
    entries: resolved.filter((member): member is WorkspaceEntry => "description" in member),
    incomplete: resolved.filter((member): member is IncompleteWorkspace => "reason" in member),
  };
};
