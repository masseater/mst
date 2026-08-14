import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import {
  descendants,
  endOffsetOf,
  flattenTextKeepingCode,
  lineOf,
  offsetOf,
} from "../markdown/nodes.ts";

import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const ITEM_MARKER_PATTERN = /^(\d+)([.)])/u;

const DECIMAL_MARKER_PATTERN = /^ {0,3}\d+(?:\.\d+)+[.)](?=\s|$)/u;

const markerNumbersIn = ({
  source,
  startOffset,
  endOffset,
}: {
  readonly source: string;
  readonly startOffset: number;
  readonly endOffset: number;
}): readonly number[] =>
  source
    .slice(startOffset, endOffset)
    .split("\n")
    .filter((line) => !DECIMAL_MARKER_PATTERN.test(line))
    .flatMap((line) => {
      const marker = ITEM_MARKER_PATTERN.exec(line.trimStart());
      const digits = marker?.[1];
      return digits === undefined ? [] : [Number(digits)];
    });

const isContiguousFromOne = (sequenceNumbers: readonly number[]): boolean =>
  sequenceNumbers.every((held, index) => held === index + 1);

const decimalMarkerLines = ({
  source,
  startOffset,
  endOffset,
}: {
  readonly source: string;
  readonly startOffset: number;
  readonly endOffset: number;
}): readonly number[] =>
  source
    .slice(startOffset, endOffset)
    .split("\n")
    .flatMap((line, index) => (index > 0 && DECIMAL_MARKER_PATTERN.test(line) ? [index] : []))
    .map((lineIndex) => source.slice(0, startOffset).split("\n").length + lineIndex);

const NON_CONTIGUOUS_MESSAGE =
  "番号付き手順の番号が 1 から始まる連続した整数になっていない。番号を振り直す。原文の番号は、処理系を通さず読む読み手にとって順序の主張そのものである。";

const DECIMAL_MESSAGE =
  "小数の手順番号を割り込ませることは禁止されている。その手順を正しい位置へ入れ、以降の番号を振り直す。";

const orderedListProblems = ({
  document,
}: {
  readonly document: NormativeDocument;
}): readonly DocumentProblem[] =>
  descendants(document.tree)
    .filter((node) => node.type === "list")
    .filter((node) => node.ordered === true)
    .filter((node) => !isInsideGeneratedRegion(offsetOf(node), document.generated))
    .flatMap((listed): readonly DocumentProblem[] => {
      const startOffset = offsetOf(listed);
      const endOffset = endOffsetOf(listed);

      const sequenceNumbers = markerNumbersIn({ source: document.source, startOffset, endOffset });
      const sequenceProblems = isContiguousFromOne(sequenceNumbers)
        ? []
        : [{ file: document.file, line: lineOf(listed), message: NON_CONTIGUOUS_MESSAGE }];

      const decimalProblems = decimalMarkerLines({
        source: document.source,
        startOffset,
        endOffset,
      }).map((line) => ({ file: document.file, line, message: DECIMAL_MESSAGE }));

      return [...sequenceProblems, ...decimalProblems];
    });

const labelMessage = (word: string): string =>
  `見出しや強調のラベルを \`${word} 0\` から始めることは禁止されている。1 から始まる番号に振り直す。`;

const zeroLabelProblems = ({
  document,
  config,
}: {
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): readonly DocumentProblem[] =>
  descendants(document.tree)
    .filter((node) => node.type === "heading" || node.type === "strong")
    .filter((node) => !isInsideGeneratedRegion(offsetOf(node), document.generated))
    .flatMap((node): readonly DocumentProblem[] => {
      const writtenText = flattenTextKeepingCode(node);
      const word = config.orderedLabelWords.find((candidate) =>
        new RegExp(`(?<![A-Za-z])${candidate}\\s*0(?![0-9])`, "u").test(writtenText),
      );

      return word === undefined
        ? []
        : [{ file: document.file, line: lineOf(node), message: labelMessage(word) }];
    });

export const brokenOrderedSequences = ({
  document,
  config,
}: {
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): readonly DocumentProblem[] => [
  ...orderedListProblems({ document }),
  ...zeroLabelProblems({ document, config }),
];
