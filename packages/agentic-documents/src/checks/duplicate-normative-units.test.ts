import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { duplicatedNormativeUnits } from "./duplicate-normative-units.ts";

const REPEATED_RULE =
  "- MUST: 実装の根拠をコードコメントに書かず、経緯はコミットメッセージの本文に残す\n";

const REPEATED_PARAGRAPH =
  "同じ段落がそのまま写されている。十分に長い本文をここに置いて単位として数えさせる。\n";

const LONG_RULE = `- MUST: ${"実装の根拠をコードコメントに書かない。".repeat(12)}\n`;

const REPEATED_POINTER = `- 詳細は ${"リポジトリの規約を集めた文書".repeat(3)} を参照する\n`;

describe("duplicatedNormativeUnits", () => {
  describe("箇条書きでない同じ段落を持つ 2 つの文書", () => {
    const it = test.extend("problems", () =>
      duplicatedNormativeUnits({
        documents: [
          toNormativeDocument({
            file: "AGENTS.md",
            source: REPEATED_PARAGRAPH,
            config: defaultConfig,
          }),
          toNormativeDocument({
            file: "packages/example/AGENTS.md",
            source: REPEATED_PARAGRAPH,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      }));

    it("段落も規範の単位として数え、写しを報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "AGENTS.md",
          line: 1,
          message:
            '同じ規範が 2 つの文書に逐語で写されている（AGENTS.md, packages/example/AGENTS.md）: "同じ段落がそのまま写されている。十分に長い本文をここに置いて単位として数えさせる。"。持ち主を 1 つ決めてそこに残し、他の文書は本文を消して持ち主を指す案内に置き換える。言い回しを変えて一致を外すことは解決ではない。',
        },
      ]);
    });
  });

  describe("見出しの下の引用に同じ規範を置いた 2 つの文書", () => {
    const it = test.extend("problems", () =>
      duplicatedNormativeUnits({
        documents: [
          toNormativeDocument({
            file: "AGENTS.md",
            source: `# 見出し\n\n> ${REPEATED_RULE}`,
            config: defaultConfig,
          }),
          toNormativeDocument({
            file: "packages/example/AGENTS.md",
            source: REPEATED_RULE,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      }));

    it("引用の中にあっても写しとして数え、その行を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "AGENTS.md",
          line: 3,
          message:
            '同じ規範が 2 つの文書に逐語で写されている（AGENTS.md, packages/example/AGENTS.md）: "MUST: 実装の根拠をコードコメントに書かず、経緯はコミットメッセージの本文に残す"。持ち主を 1 つ決めてそこに残し、他の文書は本文を消して持ち主を指す案内に置き換える。言い回しを変えて一致を外すことは解決ではない。',
        },
      ]);
    });
  });

  describe("報告の上限を超える長さの同じ規範を持つ 2 つの文書", () => {
    const it = test.extend("problems", () =>
      duplicatedNormativeUnits({
        documents: [
          toNormativeDocument({ file: "AGENTS.md", source: LONG_RULE, config: defaultConfig }),
          toNormativeDocument({
            file: "packages/example/AGENTS.md",
            source: LONG_RULE,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      }));

    it("本文を切り詰めて報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "AGENTS.md",
          line: 1,
          message:
            '同じ規範が 2 つの文書に逐語で写されている（AGENTS.md, packages/example/AGENTS.md）: "MUST: 実装の根拠をコードコメントに書かない。実装の根拠をコードコメントに書かない。実装の根拠をコードコメントに書かない。実装の根拠をコードコメントに書かない。実装の根拠をコードコメントに書かない。実装の根拠をコードコメントに書かない。…"。持ち主を 1 つ決めてそこに残し、他の文書は本文を消して持ち主を指す案内に置き換える。言い回しを変えて一致を外すことは解決ではない。',
        },
      ]);
    });
  });

  describe("同じ規範を箇条書きで持つ 2 つの文書", () => {
    const it = test.extend("problems", () =>
      duplicatedNormativeUnits({
        documents: [
          toNormativeDocument({ file: "AGENTS.md", source: REPEATED_RULE, config: defaultConfig }),
          toNormativeDocument({
            file: "packages/example/AGENTS.md",
            source: REPEATED_RULE,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      }));

    it("写しを報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "AGENTS.md",
          line: 1,
          message:
            '同じ規範が 2 つの文書に逐語で写されている（AGENTS.md, packages/example/AGENTS.md）: "MUST: 実装の根拠をコードコメントに書かず、経緯はコミットメッセージの本文に残す"。持ち主を 1 つ決めてそこに残し、他の文書は本文を消して持ち主を指す案内に置き換える。言い回しを変えて一致を外すことは解決ではない。',
        },
      ]);
    });
  });

  describe("それぞれ別の規範を持つ 2 つの文書", () => {
    const it = test.extend("problems", () =>
      duplicatedNormativeUnits({
        documents: [
          toNormativeDocument({ file: "AGENTS.md", source: REPEATED_RULE, config: defaultConfig }),
          toNormativeDocument({
            file: "packages/example/AGENTS.md",
            source: "- MUST: 依存の版をカタログに集約する\n",
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      }));

    it("1 つの文書にしか現れない規範を報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("下限に満たない短い同じ規範を持つ 2 つの文書", () => {
    const it = test.extend("problems", () =>
      duplicatedNormativeUnits({
        documents: [
          toNormativeDocument({
            file: "AGENTS.md",
            source: "- MUST: 記録する\n",
            config: defaultConfig,
          }),
          toNormativeDocument({
            file: "packages/example/AGENTS.md",
            source: "- MUST: 記録する\n",
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("同じ案内だけを持つ 2 つの文書", () => {
    const it = test.extend("problems", () =>
      duplicatedNormativeUnits({
        documents: [
          toNormativeDocument({
            file: "AGENTS.md",
            source: REPEATED_POINTER,
            config: defaultConfig,
          }),
          toNormativeDocument({
            file: "packages/example/AGENTS.md",
            source: REPEATED_POINTER,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
