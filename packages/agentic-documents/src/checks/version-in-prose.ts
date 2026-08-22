import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import { descendants, offsetOf } from "../markdown/nodes.ts";

import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const PREFIXED_VERSION_PATTERN = /(?<![\w./-])v\d+(?:\.\d+){0,3}(?!\w)/gu;

const RANGE_VERSION_PATTERN = /(?<!\w)(?:>=|<=|\^|~|>|<)\d+(?:\.\d+){0,3}(?!\w)/gu;

const complaint = (found: string): string =>
  `散文に版番号 \`${found}\` を直書きすることは禁止されている。値を消し、その版を決めているファイルを名指しする。`;

const isExcluded = ({
  found,
  patterns,
}: {
  readonly found: string;
  readonly patterns: readonly string[];
}): boolean => patterns.some((pattern) => new RegExp(pattern, "u").test(found));

export const versionLiteralsInProse = ({
  document,
  config,
}: {
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): readonly DocumentProblem[] =>
  descendants(document.tree)
    .filter((node) => node.type === "text" || node.type === "inlineCode")
    .flatMap((node): readonly DocumentProblem[] => {
      const baseOffset = offsetOf(node);

      return [
        ...node.value.matchAll(PREFIXED_VERSION_PATTERN),
        ...node.value.matchAll(RANGE_VERSION_PATTERN),
      ]
        .map((match) => ({ offset: baseOffset + match.index, found: match[0] }))
        .filter(({ offset }) => !isInsideGeneratedRegion(offset, document.generated))
        .filter(({ found }) => !isExcluded({ found, patterns: config.versionExclusionPatterns }))
        .map(({ offset, found }) => ({
          file: document.file,
          line: document.source.slice(0, offset).split("\n").length,
          message: complaint(found),
        }));
    });
