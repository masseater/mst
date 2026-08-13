import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { versionLiteralsInProse } from "./version-in-prose.ts";

const PREFIXED_VERSION_MESSAGE =
  "散文に版番号 `v26.7.0` を直書きすることは禁止されている。値を消し、その版を決めているファイルを名指しする。";

const RANGE_VERSION_MESSAGE =
  "散文に版番号 `^1.50.0` を直書きすることは禁止されている。値を消し、その版を決めているファイルを名指しする。";

describe("versionLiteralsInProse", () => {
  describe("除外の綴りに当たる版を書いた散文", () => {
    const it = test.extend("problems", () =>
      versionLiteralsInProse({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "v1 を使う\n",
          config: defaultConfig,
        }),
        config: { ...defaultConfig, versionExclusionPatterns: ["^v1$"] },
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("接頭辞付きの版を書いた散文", () => {
    const it = test.extend("problems", () =>
      versionLiteralsInProse({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "実行環境は v26.7.0 を使う\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("版を書いた行を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: PREFIXED_VERSION_MESSAGE },
      ]);
    });
  });

  describe("範囲を表す記法の版を書いた散文", () => {
    const it = test.extend("problems", () =>
      versionLiteralsInProse({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "依存は ^1.50.0 に固定する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("版を書いた行を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: RANGE_VERSION_MESSAGE },
      ]);
    });
  });

  describe("空白を挟んだ比較を書いた散文", () => {
    const it = test.extend("problems", () =>
      versionLiteralsInProse({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "項目が > 18 件あるときは分割する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("独立した領域に版を書いたコード例", () => {
    const it = test.extend("problems", () =>
      versionLiteralsInProse({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: '```json\n{ "node": "v26.7.0" }\n```\n',
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
