import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { workspaceListProblems } from "./workspace-list.ts";

const LIST_CONFIG = defaultConfig.workspaceList;

const BEGIN = LIST_CONFIG?.region.begin ?? "";

const END = LIST_CONFIG?.region.end ?? "";

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const DESCRIBED_MANIFEST = JSON.stringify({ name: "example", description: "説明" });

const UNDESCRIBED_MANIFEST = JSON.stringify({ name: "example" });

const STALE_DOCUMENT = `# ワークスペース\n\n${BEGIN}\n\n古い内容\n\n${END}\n`;

const MISSING_DOCUMENT_MESSAGE =
  "ワークスペースの一覧 `docs/workspaces.md` が無い。文書を作り、生成の境界を置く。境界の内側は機械が書くので、人は前後の散文だけを書く。";

const MISSING_REGION_MESSAGE =
  "`docs/workspaces.md` に生成の境界が無い。開始と終了の記述を置く。境界が無いと、機械がどこへ書けばよいかを決められない。";

const STALE_REGION_MESSAGE =
  "`docs/workspaces.md` の一覧が、ワークスペース定義から生成した内容と一致していない。書き込む様態で走らせて更新する。手で書き換えると次に増えたときに同じことが起きる。";

const INCOMPLETE_WORKSPACE_MESSAGE =
  "ワークスペース `packages/example` の一覧を生成できない: マニフェストに説明が無い。空欄や欠落した行を出すと、存在するものが見えなくなったまま固定される。";

describe("workspaceListProblems", () => {
  describe("一覧の設定が無い配置", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return workspaceListProblems({
        repositoryRoot,
        config: { ...defaultConfig, workspaceList: null },
        write: false,
      });
    });

    it("何も要求しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("一覧の文書が無い配置", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-workspaces-"));
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
      return workspaceListProblems({ repositoryRoot, config: defaultConfig, write: false });
    });

    it("一覧の文書が無いと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "docs/workspaces.md", line: null, message: MISSING_DOCUMENT_MESSAGE },
      ]);
    });
  });

  describe("生成の境界を持たない一覧の文書", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
      mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(
        join(repositoryRoot, "packages", "example", "package.json"),
        DESCRIBED_MANIFEST,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "docs", "workspaces.md"), "# ワークスペース\n", "utf8");
      return workspaceListProblems({ repositoryRoot, config: defaultConfig, write: false });
    });

    it("生成の境界が無いと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "docs/workspaces.md", line: null, message: MISSING_REGION_MESSAGE },
      ]);
    });
  });

  describe("境界の内側が古い一覧の文書", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
      mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(
        join(repositoryRoot, "packages", "example", "package.json"),
        DESCRIBED_MANIFEST,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "docs", "workspaces.md"), STALE_DOCUMENT, "utf8");
      return workspaceListProblems({ repositoryRoot, config: defaultConfig, write: false });
    });

    it("境界の内側が古いと報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "docs/workspaces.md", line: null, message: STALE_REGION_MESSAGE },
      ]);
    });
  });

  describe("古い一覧の文書を書き込む様態で走らせた後", () => {
    const it = test
      .extend("listDocument", async ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-workspaces-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
        mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "example", "package.json"),
          DESCRIBED_MANIFEST,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "docs", "workspaces.md"), STALE_DOCUMENT, "utf8");
        await workspaceListProblems({ repositoryRoot, config: defaultConfig, write: true });
        return readFileSync(join(repositoryRoot, "docs", "workspaces.md"), "utf8");
      })
      .extend("problems", async ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-workspaces-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
        mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "example", "package.json"),
          DESCRIBED_MANIFEST,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "docs", "workspaces.md"), STALE_DOCUMENT, "utf8");
        await workspaceListProblems({ repositoryRoot, config: defaultConfig, write: true });
        return workspaceListProblems({ repositoryRoot, config: defaultConfig, write: false });
      });

    it("境界の内側が生成結果になる", ({ listDocument }) => {
      expect(listDocument).toBe(
        `# ワークスペース\n\n${BEGIN}\n\n- \`packages/example\` — 説明\n\n${END}\n`,
      );
    });

    it("境界の内側が生成結果と一致するので報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("説明の無いワークスペースを持つ配置", () => {
    const it = test.extend("problems", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-workspaces-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
      mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(
        join(repositoryRoot, "packages", "example", "package.json"),
        UNDESCRIBED_MANIFEST,
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "docs", "workspaces.md"),
        `# ワークスペース\n\n${BEGIN}\n\n${END}\n`,
        "utf8",
      );
      return workspaceListProblems({ repositoryRoot, config: defaultConfig, write: false });
    });

    it("生成の失敗として報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "packages/example/package.json",
          line: null,
          message: INCOMPLETE_WORKSPACE_MESSAGE,
        },
      ]);
    });
  });
});
