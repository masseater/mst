import { generatedRanges, type SourceRange } from "../markdown/generated-region.ts";
import { parseMarkdown } from "../markdown/parse.ts";

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
