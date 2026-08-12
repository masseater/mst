import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { brokenOrderedSequences } from "./ordered-sequence.ts";

const NON_CONTIGUOUS_MESSAGE =
  "番号付き手順の番号が 1 から始まる連続した整数になっていない。番号を振り直す。原文の番号は、処理系を通さず読む読み手にとって順序の主張そのものである。";

const DECIMAL_MESSAGE =
  "小数の手順番号を割り込ませることは禁止されている。その手順を正しい位置へ入れ、以降の番号を振り直す。";

const PHASE_LABEL_MESSAGE =
  "見出しや強調のラベルを `Phase 0` から始めることは禁止されている。1 から始まる番号に振り直す。";

const it = test
  .extend("sequenceProblemsOfAHeadingWithoutAnOrderWord", () =>
    brokenOrderedSequences({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "## 書き方\n\n**注意**を読む\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }))
  .extend("sequenceProblemsOfAContinuationLine", () =>
    brokenOrderedSequences({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "1. 始める\n   続きの行\n2. 終える\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("sequenceProblemsOfAZeroLabelInStrongText", () =>
    brokenOrderedSequences({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "**Phase 0** を参照する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("sequenceProblemsOfNumberingThatStartsAtZero", () =>
    brokenOrderedSequences({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "0. 準備する\n1. 実行する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("sequenceProblemsOfASkippedNumber", () =>
    brokenOrderedSequences({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "1. 準備する\n2. 実行する\n4. 記録する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("sequenceProblemsOfADecimalNumberInBetween", () =>
    brokenOrderedSequences({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "1. 準備する\n1.5. 確認する\n2. 実行する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("sequenceProblemsOfAZeroLabelInAHeading", () =>
    brokenOrderedSequences({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "## Phase 0 の準備\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("sequenceProblemsOfContiguousNumberingFromOne", () =>
    brokenOrderedSequences({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "1. 準備する\n2. 実行する\n3. 記録する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  );

describe("brokenOrderedSequences", () => {
  it("順序を表す語を持たない見出しは報告しない", ({
    sequenceProblemsOfAHeadingWithoutAnOrderWord,
  }) => {
    expect(sequenceProblemsOfAHeadingWithoutAnOrderWord).toStrictEqual([]);
  });

  it("番号の続きの行は番号として数えない", ({ sequenceProblemsOfAContinuationLine }) => {
    expect(sequenceProblemsOfAContinuationLine).toStrictEqual([]);
  });

  it("強調に置かれた 0 のラベルも報告する", ({ sequenceProblemsOfAZeroLabelInStrongText }) => {
    expect(sequenceProblemsOfAZeroLabelInStrongText).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: PHASE_LABEL_MESSAGE },
    ]);
  });

  it("0 から始まる番号を報告する", ({ sequenceProblemsOfNumberingThatStartsAtZero }) => {
    expect(sequenceProblemsOfNumberingThatStartsAtZero).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: NON_CONTIGUOUS_MESSAGE },
    ]);
  });

  it("番号が飛んでいると報告する", ({ sequenceProblemsOfASkippedNumber }) => {
    expect(sequenceProblemsOfASkippedNumber).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: NON_CONTIGUOUS_MESSAGE },
    ]);
  });

  it("小数の番号が割り込むと報告する", ({ sequenceProblemsOfADecimalNumberInBetween }) => {
    expect(sequenceProblemsOfADecimalNumberInBetween).toStrictEqual([
      { file: "AGENTS.md", line: 2, message: DECIMAL_MESSAGE },
    ]);
  });

  it("順序を表す語と 0 のラベルを報告する", ({ sequenceProblemsOfAZeroLabelInAHeading }) => {
    expect(sequenceProblemsOfAZeroLabelInAHeading).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: PHASE_LABEL_MESSAGE },
    ]);
  });

  it("1 から始まる連続した番号は報告しない", ({ sequenceProblemsOfContiguousNumberingFromOne }) => {
    expect(sequenceProblemsOfContiguousNumberingFromOne).toStrictEqual([]);
  });
});
