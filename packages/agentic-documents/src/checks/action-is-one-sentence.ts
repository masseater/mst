import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import {
  descendants,
  flattenTextDroppingCode,
  leadingParagraphOf,
  lineOf,
  offsetOf,
} from "../markdown/nodes.ts";
import { actionClauseOf } from "./normative-notation.ts";

import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const COMPLAINT =
  "行動の行に理由を続けることは禁止されている。行動は 1 文で言い切り、理由はその項目の入れ子へ移す。理由を消すのではなく置き場所を変える。";

const sentenceCount = ({
  actionClause,
  terminators,
}: {
  readonly actionClause: string;
  readonly terminators: readonly string[];
}): number => {
  const trimmed = actionClause.trimEnd();
  const withoutTrailing = terminators.reduce(
    (writtenText, terminator) =>
      writtenText.endsWith(terminator) ? writtenText.slice(0, -terminator.length) : writtenText,
    trimmed,
  );

  return terminators.reduce(
    (counted, terminator) => counted + withoutTrailing.split(terminator).length - 1,
    1,
  );
};

export const rationaleOnActionLine = ({
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

      const actionClause = actionClauseOf({ text: flattenTextDroppingCode(paragraph), config });
      if (actionClause === null) return [];

      const sentences = sentenceCount({
        actionClause,
        terminators: config.sentenceTerminators,
      });
      if (sentences < 2) return [];

      return [{ file: document.file, line: lineOf(member), message: COMPLAINT }];
    });
