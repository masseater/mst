import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { companionFileProblems } from "./companion-files.ts";

const NORMATIVE_SOURCE = "# 規約\n";

describe("companionFileProblems", () => {
  describe("入れ子の規範文書に対応ファイルが無い配置", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);

      return companionFileProblems({
        repositoryRoot: root,
        documents: [
          toNormativeDocument({
            file: "packages/example/AGENTS.md",
            source: NORMATIVE_SOURCE,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      });
    });

    it("その階層の対応ファイルを名指しで報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "packages/example/CLAUDE.md",
          line: null,
          message:
            "規範文書の隣に `CLAUDE.md` が無い。この名前を期待して読む主体には指示が届かない。規範文書への結び付きとして作る。",
        },
      ]);
    });
  });

  describe("根の規範文書に対応ファイルが無い配置", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);

      return companionFileProblems({
        repositoryRoot: root,
        documents: [
          toNormativeDocument({
            file: "AGENTS.md",
            source: NORMATIVE_SOURCE,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      });
    });

    it("対応ファイルが無いと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "CLAUDE.md",
          line: null,
          message:
            "規範文書の隣に `CLAUDE.md` が無い。この名前を期待して読む主体には指示が届かない。規範文書への結び付きとして作る。",
        },
      ]);
    });
  });

  describe("結び付きが隣の規範文書を指す配置", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);
      symlinkSync("AGENTS.md", join(root, "CLAUDE.md"));

      return companionFileProblems({
        repositoryRoot: root,
        documents: [
          toNormativeDocument({
            file: "AGENTS.md",
            source: NORMATIVE_SOURCE,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      });
    });

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("結び付きが隣の規範文書以外を指す配置", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);
      symlinkSync("README.md", join(root, "CLAUDE.md"));

      return companionFileProblems({
        repositoryRoot: root,
        documents: [
          toNormativeDocument({
            file: "AGENTS.md",
            source: NORMATIVE_SOURCE,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      });
    });

    it("指し先を名指しで報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "CLAUDE.md",
          line: null,
          message:
            "`CLAUDE.md` の結び付きが `README.md` を指しており、隣の規範文書ではない。同じ場所の規範文書を指すよう作り直す。",
        },
      ]);
    });
  });

  describe("中身を持つ通常のファイルが対応ファイルの位置にある配置", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);
      writeFileSync(join(root, "CLAUDE.md"), "# 別の規約\n\n中身がある。\n");

      return companionFileProblems({
        repositoryRoot: root,
        documents: [
          toNormativeDocument({
            file: "AGENTS.md",
            source: NORMATIVE_SOURCE,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      });
    });

    it("中身を持つ通常のファイルを報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "CLAUDE.md",
          line: null,
          message:
            "`CLAUDE.md` が通常のファイルとして中身を持っている。同じ指示の実体が 2 つある状態になる。中身を規範文書へ移してから、規範文書への結び付きに置き換える。",
        },
      ]);
    });
  });

  describe("参照 1 つだけを中身に持つ通常のファイルが対応ファイルの位置にある配置", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);
      writeFileSync(join(root, "CLAUDE.md"), "@AGENTS.md\n");

      return companionFileProblems({
        repositoryRoot: root,
        documents: [
          toNormativeDocument({
            file: "AGENTS.md",
            source: NORMATIVE_SOURCE,
            config: defaultConfig,
          }),
        ],
        config: defaultConfig,
      });
    });

    it("参照 1 つだけのファイルも報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "CLAUDE.md",
          line: null,
          message:
            "`CLAUDE.md` が規範文書を指す参照 1 つだけを中身として持っている。読み手によっては参照として解釈されず、その 1 行だけが指示として読まれる。規範文書への結び付きに置き換える。",
        },
      ]);
    });
  });
});
