import { lineAtOffset } from "@mst/utils";

import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import { descendants, offsetOf } from "../markdown/nodes.ts";
import { negatedKeywordPattern } from "./normative-notation.ts";

import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const message = (found: string, expected: string): string =>
  `判断キーワードとして \`${found}\` を使うことは禁止されている。\`${expected}:\` に置き換える。行頭の 1 語で禁止だと判別できる綴りに固定するため。`;

export const negatedKeywordSpellings = ({
  document,
  config,
}: {
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): readonly DocumentProblem[] =>
  descendants(document.tree)
    .filter((node) => node.type === "text")
    .flatMap((node): readonly DocumentProblem[] => {
      const baseOffset = offsetOf(node);

      return [...node.value.matchAll(negatedKeywordPattern(config))]
        .map((match) => ({ offset: baseOffset + match.index, found: match[0] }))
        .filter(({ offset }) => !isInsideGeneratedRegion(offset, document.generated))
        .map(({ offset, found }) => ({
          file: document.file,
          line: lineAtOffset(document.source, offset),
          message: message(found, config.prohibitionKeyword),
        }));
    });
