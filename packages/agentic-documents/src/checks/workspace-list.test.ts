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

const it = test
  .extend("listProblemsWithoutAListConfiguration", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-workspaces-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    return workspaceListProblems({
      repositoryRoot,
      config: { ...defaultConfig, workspaceList: null },
      write: false,
    });
  })
  .extend("listProblemsWithoutTheListDocument", async ({}, { onCleanup }) => {
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
  })
  .extend("listProblemsWithoutAGeneratedRegion", async ({}, { onCleanup }) => {
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
  })
  .extend("listProblemsOfAStaleRegion", async ({}, { onCleanup }) => {
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
  })
  .extend("listDocumentAfterWriting", async ({}, { onCleanup }) => {
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
  .extend("listProblemsAfterWriting", async ({}, { onCleanup }) => {
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
  })
  .extend("listProblemsOfAWorkspaceWithoutADescription", async ({}, { onCleanup }) => {
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

describe("workspaceListProblems", () => {
  it("一覧の設定が無い配置では何も要求しない", ({ listProblemsWithoutAListConfiguration }) => {
    expect(listProblemsWithoutAListConfiguration).toStrictEqual([]);
  });

  it("一覧の文書が無いと報告する", ({ listProblemsWithoutTheListDocument }) => {
    expect(listProblemsWithoutTheListDocument).toStrictEqual([
      { file: "docs/workspaces.md", line: null, message: MISSING_DOCUMENT_MESSAGE },
    ]);
  });

  it("生成の境界が無いと報告する", ({ listProblemsWithoutAGeneratedRegion }) => {
    expect(listProblemsWithoutAGeneratedRegion).toStrictEqual([
      { file: "docs/workspaces.md", line: null, message: MISSING_REGION_MESSAGE },
    ]);
  });

  it("境界の内側が古いと報告する", ({ listProblemsOfAStaleRegion }) => {
    expect(listProblemsOfAStaleRegion).toStrictEqual([
      { file: "docs/workspaces.md", line: null, message: STALE_REGION_MESSAGE },
    ]);
  });

  it("書き込む様態では境界の内側が生成結果になる", ({ listDocumentAfterWriting }) => {
    expect(listDocumentAfterWriting).toBe(
      `# ワークスペース\n\n${BEGIN}\n\n- \`packages/example\` — 説明\n\n${END}\n`,
    );
  });

  it("境界の内側が生成結果と一致していれば報告しない", ({ listProblemsAfterWriting }) => {
    expect(listProblemsAfterWriting).toStrictEqual([]);
  });

  it("説明の無いワークスペースがあると生成の失敗として報告する", ({
    listProblemsOfAWorkspaceWithoutADescription,
  }) => {
    expect(listProblemsOfAWorkspaceWithoutADescription).toStrictEqual([
      { file: "packages/example/package.json", line: null, message: INCOMPLETE_WORKSPACE_MESSAGE },
    ]);
  });
});
