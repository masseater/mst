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

const it = test
  .extend("problemsForAParagraphWrittenTwice", () =>
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
    }))
  .extend("problemsForARuleQuotedUnderAHeading", () =>
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
    }),
  )
  .extend("problemsForALongRuleWrittenTwice", () =>
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
    }),
  )
  .extend("problemsForARuleWrittenInTwoDocuments", () =>
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
    }),
  )
  .extend("problemsForARuleWrittenInOneDocumentOnly", () =>
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
    }),
  )
  .extend("problemsForAShortRuleWrittenTwice", () =>
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
    }),
  )
  .extend("problemsForAPointerWrittenTwice", () =>
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
    }),
  );

describe("duplicatedNormativeUnits", () => {
  it("箇条書きでない段落も規範の単位として数える", ({ problemsForAParagraphWrittenTwice }) => {
    expect(problemsForAParagraphWrittenTwice).toStrictEqual([
      {
        file: "AGENTS.md",
        line: 1,
        message:
          '同じ規範が 2 つの文書に逐語で写されている（AGENTS.md, packages/example/AGENTS.md）: "同じ段落がそのまま写されている。十分に長い本文をここに置いて単位として数えさせる。"。持ち主を 1 つ決めてそこに残し、他の文書は本文を消して持ち主を指す案内に置き換える。言い回しを変えて一致を外すことは解決ではない。',
      },
    ]);
  });

  it("引用の中や見出しの下にあっても同じ規範は写しとして数える", ({
    problemsForARuleQuotedUnderAHeading,
  }) => {
    expect(problemsForARuleQuotedUnderAHeading).toStrictEqual([
      {
        file: "AGENTS.md",
        line: 3,
        message:
          '同じ規範が 2 つの文書に逐語で写されている（AGENTS.md, packages/example/AGENTS.md）: "MUST: 実装の根拠をコードコメントに書かず、経緯はコミットメッセージの本文に残す"。持ち主を 1 つ決めてそこに残し、他の文書は本文を消して持ち主を指す案内に置き換える。言い回しを変えて一致を外すことは解決ではない。',
      },
    ]);
  });

  it("長い規範は報告の中で切り詰められる", ({ problemsForALongRuleWrittenTwice }) => {
    expect(problemsForALongRuleWrittenTwice).toStrictEqual([
      {
        file: "AGENTS.md",
        line: 1,
        message:
          '同じ規範が 2 つの文書に逐語で写されている（AGENTS.md, packages/example/AGENTS.md）: "MUST: 実装の根拠をコードコメントに書かない。実装の根拠をコードコメントに書かない。実装の根拠をコードコメントに書かない。実装の根拠をコードコメントに書かない。実装の根拠をコードコメントに書かない。実装の根拠をコードコメントに書かない。…"。持ち主を 1 つ決めてそこに残し、他の文書は本文を消して持ち主を指す案内に置き換える。言い回しを変えて一致を外すことは解決ではない。',
      },
    ]);
  });

  it("2 つの文書に同じ規範が写されていると報告する", ({
    problemsForARuleWrittenInTwoDocuments,
  }) => {
    expect(problemsForARuleWrittenInTwoDocuments).toStrictEqual([
      {
        file: "AGENTS.md",
        line: 1,
        message:
          '同じ規範が 2 つの文書に逐語で写されている（AGENTS.md, packages/example/AGENTS.md）: "MUST: 実装の根拠をコードコメントに書かず、経緯はコミットメッセージの本文に残す"。持ち主を 1 つ決めてそこに残し、他の文書は本文を消して持ち主を指す案内に置き換える。言い回しを変えて一致を外すことは解決ではない。',
      },
    ]);
  });

  it("1 つの文書にしか現れない規範は報告しない", ({ problemsForARuleWrittenInOneDocumentOnly }) => {
    expect(problemsForARuleWrittenInOneDocumentOnly).toStrictEqual([]);
  });

  it("下限に満たない短い単位は報告しない", ({ problemsForAShortRuleWrittenTwice }) => {
    expect(problemsForAShortRuleWrittenTwice).toStrictEqual([]);
  });

  it("案内だけの単位は報告しない", ({ problemsForAPointerWrittenTwice }) => {
    expect(problemsForAPointerWrittenTwice).toStrictEqual([]);
  });
});
