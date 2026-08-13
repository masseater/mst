import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { frontmatterProblems } from "./frontmatter-description.ts";

const MISSING_FRONTMATTER_MESSAGE =
  "規範文書に前置きが無い。文書の先頭に区切り行で囲んだ前置きを置き、必須の項目を書く。一覧を機械で組むために、説明が同じ位置に同じ形である必要がある。";

describe("frontmatterProblems", () => {
  describe("前置きが対応表ではなく一覧である規範文書", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ name: "example", description: "説明" }),
      );

      return frontmatterProblems({
        repositoryRoot: root,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "---\n- 一覧\n---\n\n# 規約\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("前置きが無いものとして報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: MISSING_FRONTMATTER_MESSAGE },
      ]);
    });
  });

  describe("必須の前置き項目を 1 つも持たない設定", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ name: "example", description: "説明" }),
      );

      return frontmatterProblems({
        repositoryRoot: root,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "---\ndescription: 説明\n---\n\n# 規約\n",
          config: defaultConfig,
        }),
        config: { ...defaultConfig, requiredFrontmatterFields: [] },
      });
    });

    it("何も要求せず、何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("前置きを持たない規範文書", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });

      return frontmatterProblems({
        repositoryRoot: root,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "# 規約\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("前置きが無いことを報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: MISSING_FRONTMATTER_MESSAGE },
      ]);
    });
  });

  describe("必須の前置き項目を空の値で置いた規範文書", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });

      return frontmatterProblems({
        repositoryRoot: root,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "---\ndescription: ''\n---\n\n# 規約\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("値が空であることを報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "AGENTS.md",
          line: 1,
          message: "前置きの項目 `description` が無いか、値が空である。値を書く。",
        },
      ]);
    });
  });

  describe("マニフェストの説明と食い違う説明を前置きに持つ規範文書", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ name: "example", description: "マニフェスト側の説明" }),
      );

      return frontmatterProblems({
        repositoryRoot: root,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "---\ndescription: 前置き側の説明\n---\n\n# 規約\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("両方の値を並べて食い違いを報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "AGENTS.md",
          line: 1,
          message:
            '前置きの `description` とマニフェストの説明が一致していない。前置き: "前置き側の説明" / マニフェスト: "マニフェスト側の説明"。どちらが正しいかを決め、両方を同じ値に揃える。',
        },
      ]);
    });
  });

  describe("マニフェストの説明と一致する説明を前置きに持つ規範文書", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ name: "example", description: "同じ説明" }),
      );

      return frontmatterProblems({
        repositoryRoot: root,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "---\ndescription: 同じ説明\n---\n\n# 規約\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("マニフェストを持たない場所に置かれた規範文書", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });

      return frontmatterProblems({
        repositoryRoot: root,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "---\ndescription: 説明\n---\n\n# 規約\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("前置きの検査だけを行い、何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
