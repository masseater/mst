import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { normativeDocumentsIn } from "@mst/repository-checks";

import { toNormativeDocument, type NormativeDocument } from "./normative-documents.ts";
import { findFilesNamed, findFilesSuffixed } from "./repository-files.ts";
import { collectWorkspaces } from "./workspaces.ts";

import type { AgenticDocumentsConfig } from "../config.ts";

const readDocuments = async ({
  repositoryRoot,
  files,
  config,
}: {
  readonly repositoryRoot: string;
  readonly files: readonly string[];
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly NormativeDocument[]> =>
  Promise.all(
    files.map(async (file): Promise<NormativeDocument> => {
      const source = await readFile(join(repositoryRoot, file), "utf-8");
      return toNormativeDocument({ file, source, config });
    }),
  );

const normativeDocumentFiles = async ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly string[]> => {
  const named = await findFilesNamed({
    repositoryRoot,
    fileName: config.normativeDocumentFileName,
    ignoredDirectories: config.ignoredDirectories,
  });

  const listedWorkspaces = await collectWorkspaces({
    repositoryRoot,
    definitionFile: config.workspaceDefinition.file,
    definitionField: config.workspaceDefinition.field,
  });

  const inDeclaredPlaces = normativeDocumentsIn({
    repositoryRoot,
    places: {
      fileName: config.normativeDocumentFileName,
      directories: config.normativeDocumentDirectories,
    },
    workspaceDirectories: listedWorkspaces.entries.map((listed) => listed.directory),
  });

  return [...new Set([...named, ...inDeclaredPlaces])].toSorted();
};

export const loadNormativeDocuments = async ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly NormativeDocument[]> => {
  const files = await normativeDocumentFiles({ repositoryRoot, config });
  return readDocuments({ repositoryRoot, files, config });
};

export const loadReferenceSources = async ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly NormativeDocument[]> => {
  const files = await findFilesSuffixed({
    repositoryRoot,
    suffix: config.documentFileSuffix,
    ignoredDirectories: config.ignoredDirectories,
  });

  return readDocuments({ repositoryRoot, files, config });
};
