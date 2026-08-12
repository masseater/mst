import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { contrastiveCodePairs } from "./contrastive-code-pair.ts";

const PAIR_MESSAGE =
  "同じ節に良い例と悪い例のコードを対で置くことは禁止されている。差を機械が判別できるなら検査を作り、例はその検査の説明文書へ移す。判別できないなら例を消し、何を見て判断するのかを条件と行動として書く。";

const it = test
  .extend("problemsForAPairSplitByADeeperHeading", () =>
    contrastiveCodePairs({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source:
          "## 書き方\n\n### 例\n\n```ts\n// 悪い例\nconst a = 1;\n```\n\n```ts\n<!-- 良い例 -->\nconst count = 1;\n```\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }))
  .extend("problemsForCodeWithoutALeadingOrEmptyComment", () =>
    contrastiveCodePairs({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source:
          "## 書き方\n\n```ts\nconst a = 1;\n```\n\n```ts\n```\n\n```ts\n//\nconst b = 2;\n```\n\n```ts\n/* 手順 */\nconst c = 3;\n```\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("problemsForAPairInsideOneSection", () =>
    contrastiveCodePairs({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source:
          "## 書き方\n\n悪い例:\n\n```ts\nconst a = 1;\n```\n\n良い例:\n\n```ts\nconst count = 1;\n```\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("problemsForASectionCarryingOneMarkerOnly", () =>
    contrastiveCodePairs({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "## 書き方\n\n悪い例:\n\n```ts\nconst a = 1;\n```\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("problemsForMarkersSplitAcrossSections", () =>
    contrastiveCodePairs({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source:
          "## 避ける形\n\n悪い例:\n\n```ts\nconst a = 1;\n```\n\n## 望ましい形\n\n良い例:\n\n```ts\nconst count = 1;\n```\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("problemsForCodeCarryingNoMarker", () =>
    contrastiveCodePairs({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "## 書き方\n\n```ts\nconst count = 1;\n```\n\n```ts\nconst total = 2;\n```\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  );

describe("contrastiveCodePairs", () => {
  it("節の境界より深い見出しは節を変えないので、またいだ対も報告する", ({
    problemsForAPairSplitByADeeperHeading,
  }) => {
    expect(problemsForAPairSplitByADeeperHeading).toStrictEqual([
      { file: "AGENTS.md", line: 5, message: PAIR_MESSAGE },
      { file: "AGENTS.md", line: 10, message: PAIR_MESSAGE },
    ]);
  });

  it("先頭行が注釈でないコードや、注釈が空のコードは対の印を持たない", ({
    problemsForCodeWithoutALeadingOrEmptyComment,
  }) => {
    expect(problemsForCodeWithoutALeadingOrEmptyComment).toStrictEqual([]);
  });

  it("同じ節に置かれた対の例を両方報告する", ({ problemsForAPairInsideOneSection }) => {
    expect(problemsForAPairInsideOneSection).toStrictEqual([
      { file: "AGENTS.md", line: 5, message: PAIR_MESSAGE },
      { file: "AGENTS.md", line: 11, message: PAIR_MESSAGE },
    ]);
  });

  it("片方の印しか無い節は報告しない", ({ problemsForASectionCarryingOneMarkerOnly }) => {
    expect(problemsForASectionCarryingOneMarkerOnly).toStrictEqual([]);
  });

  it("別の節に分かれていれば報告しない", ({ problemsForMarkersSplitAcrossSections }) => {
    expect(problemsForMarkersSplitAcrossSections).toStrictEqual([]);
  });

  it("印を持たないコードは報告しない", ({ problemsForCodeCarryingNoMarker }) => {
    expect(problemsForCodeCarryingNoMarker).toStrictEqual([]);
  });
});
