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
        workspaceDirectories: [],
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
        workspaceDirectories: [],
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
        workspaceDirectories: [],
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
        workspaceDirectories: [],
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
        workspaceDirectories: [],
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
        workspaceDirectories: [],
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
        workspaceDirectories: [],
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
        workspaceDirectories: [],
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
        workspaceDirectories: [],
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
        workspaceDirectories: [],
      });
    });

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("自分のワークスペースが同じ位置に持つ文書を、ワークスペース名を省いて書いた散文", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/user/docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "packages/user/docs/rules.md"), "# 規約\n", "utf8");
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "packages/user/AGENTS.md",
          source: "このワークスペースの `docs/rules.md` を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
        workspaceDirectories: ["packages/user"],
      });
    });

    it("自分のワークスペースの下で解決できるので何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("自分のワークスペースの下にも無い文書を、ワークスペース名を省いて書いた散文", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/user"), { recursive: true });
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "packages/user/AGENTS.md",
          source: "このワークスペースの `docs/rules.md` を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
        workspaceDirectories: ["packages/user"],
      });
    });

    it("指し先が実在しないと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "packages/user/AGENTS.md", line: 1, message: MISSING_FILE_MESSAGE },
      ]);
    });
  });

  describe("ワークスペースの下で解決できるが、その見出しを持たない指し先", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/user/docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "packages/user/docs/rules.md"), "# 規約\n", "utf8");
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "packages/user/AGENTS.md",
          source: "`docs/rules.md#存在しない見出し` を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
        workspaceDirectories: ["packages/user"],
      });
    });

    it("解決できたワークスペースの文書を指して、位置が無いと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "packages/user/AGENTS.md",
          line: 1,
          message:
            "参照 `docs/rules.md#存在しない見出し` が指す位置が `packages/user/docs/rules.md` に無い。現在の見出しを指すか、位置の指定を消す。指していた節の内容が今どこにあるかを確かめる。",
        },
      ]);
    });
  });

  describe("ワークスペースの文書が、別のワークスペースにしか無い指し先を書いた散文", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/other/docs"), { recursive: true });
      mkdirSync(join(repositoryRoot, "packages/user"), { recursive: true });
      writeFileSync(join(repositoryRoot, "packages/other/docs/rules.md"), "# 規約\n", "utf8");
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "packages/user/AGENTS.md",
          source: "`docs/rules.md` を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
        workspaceDirectories: ["packages/other", "packages/user"],
      });
    });

    it("自分のワークスペースの下に無いので報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "packages/user/AGENTS.md", line: 1, message: MISSING_FILE_MESSAGE },
      ]);
    });
  });

  describe("どのワークスペースにも属さない文書が、ワークスペース配下の指し先を書いた散文", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/user/docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "packages/user/docs/rules.md"), "# 規約\n", "utf8");
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "`docs/rules.md` を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
        workspaceDirectories: ["packages/user"],
      });
    });

    it("持ち主がいないので根からだけ解決し、報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: MISSING_FILE_MESSAGE },
      ]);
    });
  });

  describe("入れ子のワークスペースが持つ文書", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "apps/web/packages/inner/docs"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "apps/web/packages/inner/docs/rules.md"),
        "# 規約\n",
        "utf8",
      );
      return brokenReferences({
        repositoryRoot,
        document: toNormativeDocument({
          file: "apps/web/packages/inner/AGENTS.md",
          source: "`docs/rules.md` を読む\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
        workspaceDirectories: ["apps/web", "apps/web/packages/inner"],
      });
    });

    it("最も深く一致するワークスペースを持ち主として解決する", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
