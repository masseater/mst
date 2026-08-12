import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { versionLiteralsInProse } from "./version-in-prose.ts";

const PREFIXED_VERSION_MESSAGE =
  "散文に版番号 `v26.7.0` を直書きすることは禁止されている。値を消し、その版を決めているファイルを名指しする。";

const RANGE_VERSION_MESSAGE =
  "散文に版番号 `^1.50.0` を直書きすることは禁止されている。値を消し、その版を決めているファイルを名指しする。";

const it = test
  .extend("versionProblemsOfAnExcludedVersion", () =>
    versionLiteralsInProse({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "v1 を使う\n",
        config: defaultConfig,
      }),
      config: { ...defaultConfig, versionExclusionPatterns: ["^v1$"] },
    }))
  .extend("versionProblemsOfAPrefixedVersion", () =>
    versionLiteralsInProse({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "実行環境は v26.7.0 を使う\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("versionProblemsOfARangeVersion", () =>
    versionLiteralsInProse({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "依存は ^1.50.0 に固定する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("versionProblemsOfASpacedComparison", () =>
    versionLiteralsInProse({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "項目が > 18 件あるときは分割する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("versionProblemsOfAFencedCodeExample", () =>
    versionLiteralsInProse({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: '```json\n{ "node": "v26.7.0" }\n```\n',
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  );

describe("versionLiteralsInProse", () => {
  it("除外の綴りに当たる版は報告しない", ({ versionProblemsOfAnExcludedVersion }) => {
    expect(versionProblemsOfAnExcludedVersion).toStrictEqual([]);
  });

  it("接頭辞付きの版を報告する", ({ versionProblemsOfAPrefixedVersion }) => {
    expect(versionProblemsOfAPrefixedVersion).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: PREFIXED_VERSION_MESSAGE },
    ]);
  });

  it("範囲を表す記法の版を報告する", ({ versionProblemsOfARangeVersion }) => {
    expect(versionProblemsOfARangeVersion).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: RANGE_VERSION_MESSAGE },
    ]);
  });

  it("空白を挟んだ比較の表現は報告しない", ({ versionProblemsOfASpacedComparison }) => {
    expect(versionProblemsOfASpacedComparison).toStrictEqual([]);
  });

  it("独立した領域のコード例は報告しない", ({ versionProblemsOfAFencedCodeExample }) => {
    expect(versionProblemsOfAFencedCodeExample).toStrictEqual([]);
  });
});
