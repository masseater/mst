import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { brokenReferences } from "./reference-targets.ts";

const MISSING_FILE_MESSAGE =
  "参照 `docs/rules.md` の指し先 `docs/rules.md` が実在しない。参照を更新するか、参照ごと消す。";

const UNREADABLE_ANCHOR_MESSAGE =
  "参照 `docs/rules.md#%E0%A4%A` が指す位置が `docs/rules.md` に無い。現在の見出しを指すか、位置の指定を消す。指していた節の内容が今どこにあるかを確かめる。";

const MISSING_ANCHOR_MESSAGE =
  "参照 `docs/rules.md#存在しない見出し` が指す位置が `docs/rules.md` に無い。現在の見出しを指すか、位置の指定を消す。指していた節の内容が今どこにあるかを確かめる。";

describe("brokenReferences", () => {
  describe("実在する文書をコード表記で書いた散文", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "docs", "rules.md"), "# 規約\n", "utf8");
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "`docs/rules.md` と `rules.md` を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("リポジトリ相対パスを参照として辿り何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("実在しない文書をコード表記で書いた散文", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "`docs/rules.md` を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("指し先が実在しないと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: MISSING_FILE_MESSAGE },
      ]);
    });
  });

  describe("印を伴う指し先を書いた散文", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "詳細は @docs/rules.md を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("参照として辿り指し先が実在しないと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: MISSING_FILE_MESSAGE },
      ]);
    });
  });

  describe("読み解けない綴りの見出し指定を書いた参照", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "docs", "rules.md"), "# 規約\n", "utf8");
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "詳しくは [規約](docs/rules.md#%E0%A4%A) を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("そのまま見出し名として扱い実在しないと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: UNREADABLE_ANCHOR_MESSAGE },
      ]);
    });
  });

  describe("末尾の井桁だけを書いた参照", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "docs", "rules.md"), "# 規約\n", "utf8");
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "詳しくは [規約](docs/rules.md#) を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("見出しを指していないものとして何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("実在しない文書を指す参照", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "詳しくは [規約](docs/rules.md) を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("指し先が実在しないと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: MISSING_FILE_MESSAGE },
      ]);
    });
  });

  describe("実在する文書を指す参照", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "docs", "rules.md"), "# 規約\n", "utf8");
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "詳しくは [規約](docs/rules.md) を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("実在しない見出しを指す参照", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "docs", "rules.md"), "# 規約\n\n## 書き方\n", "utf8");
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "詳しくは [規約](docs/rules.md#存在しない見出し) を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("指す位置が無いと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: MISSING_ANCHOR_MESSAGE },
      ]);
    });
  });

  describe("実在する見出しを指す参照", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "docs", "rules.md"), "# 規約\n\n## 書き方\n", "utf8");
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "詳しくは [規約](docs/rules.md#書き方) を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("リポジトリの外を指す参照", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "詳しくは [外部](https://example.com/rules.md) を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      });
    });

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
