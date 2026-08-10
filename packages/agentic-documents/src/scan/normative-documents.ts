import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { generatedRanges, type SourceRange } from "../markdown/generated-region.ts";
import { parseMarkdown } from "../markdown/parse.ts";
import { findFilesNamed } from "./repository-files.ts";

import type { Root } from "mdast";
import type { AgenticDocumentsConfig } from "../config.ts";

export type NormativeDocument = {
  readonly file: string;
  readonly source: string;
  readonly tree: Root;
  readonly generated: readonly SourceRange[];
};

export const toNormativeDocument = ({
  file,
  source,
  config,
}: {
  readonly file: string;
  readonly source: string;
  readonly config: AgenticDocumentsConfig;
}): NormativeDocument => ({
  file,
  source,
  tree: parseMarkdown(source),
  generated: generatedRanges(source, config.generatedRegionBoundaries),
});

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
