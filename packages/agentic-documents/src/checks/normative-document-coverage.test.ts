import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { missingNormativeDocuments } from "./normative-document-coverage.ts";

const DESCRIBED_MANIFEST = JSON.stringify({ name: "example", description: "説明" });

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const NORMATIVE_DOCUMENT = "# 規約\n";

const CONFIG_DECLARING_NO_DIRECTORY = { ...defaultConfig, normativeDocumentDirectories: [] };

const EMPTY_DECLARED_DIRECTORY_MESSAGE =
  "`docs/guidelines` が規範文書の置き場として宣言されているのに、そこに文書が 1 つも無い。文書を置くか、宣言から外す。宣言だけが残ると、この置き場は検査されているのに何も見ていない状態になり、報告が 0 件であることが根拠として読めなくなる。";

const MISSING_DOCUMENT_MESSAGE =
  "この場所に `AGENTS.md` が無い。ここで作業する読み手は、固有の規約が無いのか書かれていないだけなのかを区別できない。この場所が守るものを書く。見出しだけの空の文書で通すと、無いことすら読み取れなくなる。";

describe("missingNormativeDocuments", () => {
  describe("規範文書を持たないワークスペースを抱えたリポジトリ", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf8");
      writeFileSync(
        join(repositoryRoot, "packages", "example", "package.json"),
        DESCRIBED_MANIFEST,
        "utf8",
      );
      return missingNormativeDocuments({ repositoryRoot, config: CONFIG_DECLARING_NO_DIRECTORY });
    });

    it("そのワークスペースに置かれるべき場所を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "packages/example/AGENTS.md",
          line: null,
          message: MISSING_DOCUMENT_MESSAGE,
        },
      ]);
    });
  });

  describe("ルートにだけ規範文書が無いリポジトリ", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(
        join(repositoryRoot, "packages", "example", "package.json"),
        DESCRIBED_MANIFEST,
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "packages", "example", "AGENTS.md"),
        NORMATIVE_DOCUMENT,
        "utf8",
      );
      return missingNormativeDocuments({ repositoryRoot, config: CONFIG_DECLARING_NO_DIRECTORY });
    });

    it("ルートに置かれるべき場所を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: null, message: MISSING_DOCUMENT_MESSAGE },
      ]);
    });
  });

  describe("すべての場所が規範文書を持つリポジトリ", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf8");
      writeFileSync(
        join(repositoryRoot, "packages", "example", "package.json"),
        DESCRIBED_MANIFEST,
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "packages", "example", "AGENTS.md"),
        NORMATIVE_DOCUMENT,
        "utf8",
      );
      return missingNormativeDocuments({ repositoryRoot, config: CONFIG_DECLARING_NO_DIRECTORY });
    });

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("マニフェストを持たないディレクトリを抱えたリポジトリ", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages", "not-a-workspace"), { recursive: true });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf8");
      writeFileSync(
        join(repositoryRoot, "packages", "not-a-workspace", "readme.txt"),
        "マニフェストが無い\n",
        "utf8",
      );
      return missingNormativeDocuments({ repositoryRoot, config: CONFIG_DECLARING_NO_DIRECTORY });
    });

    it("作業の単位ではないので報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("ワークスペースとして宣言されていないディレクトリを抱えたリポジトリ", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "tools", "helper"), { recursive: true });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf8");
      writeFileSync(
        join(repositoryRoot, "tools", "helper", "package.json"),
        DESCRIBED_MANIFEST,
        "utf8",
      );
      return missingNormativeDocuments({ repositoryRoot, config: CONFIG_DECLARING_NO_DIRECTORY });
    });

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("規範文書の置き場として宣言された場所が無いリポジトリ", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
      writeFileSync(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf8");
      return missingNormativeDocuments({
        repositoryRoot,
        config: { ...defaultConfig, normativeDocumentDirectories: ["docs/guidelines"] },
      });
    });

    it("宣言された置き場が何も持たないと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "docs/guidelines",
          line: null,
          message: EMPTY_DECLARED_DIRECTORY_MESSAGE,
        },
      ]);
    });
  });

  describe("規範文書の置き場として宣言された場所が文書を持つリポジトリ", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "docs", "guidelines"), { recursive: true });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
      writeFileSync(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf8");
      writeFileSync(
        join(repositoryRoot, "docs", "guidelines", "tests.md"),
        NORMATIVE_DOCUMENT,
        "utf8",
      );
      return missingNormativeDocuments({
        repositoryRoot,
        config: { ...defaultConfig, normativeDocumentDirectories: ["docs/guidelines"] },
      });
    });

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
