import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import {
  descendants,
  flattenTextDroppingCode,
  leadingParagraphOf,
  lineOf,
  offsetOf,
} from "../markdown/nodes.ts";
import { keywordStatementPattern } from "./normative-notation.ts";

import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const complaint = (counted: number): string =>
  `1 つの項目に判断キーワードを ${counted} 個置くことは禁止されている。条件を親の項目へ上げ、判断ごとに入れ子の項目を作る。`;

export const multipleDecisionKeywords = ({
  document,
  config,
}: {
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): readonly DocumentProblem[] =>
  descendants(document.tree)
    .filter((node) => node.type === "listItem")
    .filter((node) => !isInsideGeneratedRegion(offsetOf(node), document.generated))
    .flatMap((member): readonly DocumentProblem[] => {
      const paragraph = leadingParagraphOf(member);
      if (paragraph === null) return [];

      const statements = [
        ...flattenTextDroppingCode(paragraph).matchAll(keywordStatementPattern(config)),
      ];
      if (statements.length < 2) return [];

      return [{ file: document.file, line: lineOf(member), message: complaint(statements.length) }];
    });
