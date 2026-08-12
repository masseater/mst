import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { toNormativeDocument, type NormativeDocument } from "./normative-documents.ts";
import { findFilesNamed } from "./repository-files.ts";

import type { AgenticDocumentsConfig } from "../config.ts";

export const loadNormativeDocuments = async ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly NormativeDocument[]> => {
  const files = await findFilesNamed({
    repositoryRoot,
    fileName: config.normativeDocumentFileName,
    ignoredDirectories: config.ignoredDirectories,
  });

  return Promise.all(
    files.map(async (file): Promise<NormativeDocument> => {
      const source = await readFile(join(repositoryRoot, file), "utf-8");
      return toNormativeDocument({ file, source, config });
    }),
  );
};
