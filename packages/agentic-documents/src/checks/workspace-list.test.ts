import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { workspaceListProblems } from "./workspace-list.ts";

const LIST_CONFIG = defaultConfig.workspaceList;

const BEGIN = LIST_CONFIG?.region.begin ?? "";

const END = LIST_CONFIG?.region.end ?? "";

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "agentic-documents-workspaces-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });

  for (const [path, text] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }

  return root;
};

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const DESCRIBED_MANIFEST = JSON.stringify({ name: "example", description: "説明" });

describe("workspaceListProblems", () => {
  test("一覧の文書が無いと報告する", async () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/example/package.json": DESCRIBED_MANIFEST,
    });

    const problems = await workspaceListProblems({
      repositoryRoot: root,
      config: defaultConfig,
      write: false,
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("生成の境界が無いと報告する", async () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/example/package.json": DESCRIBED_MANIFEST,
      "docs/workspaces.md": "# ワークスペース\n",
    });

    const problems = await workspaceListProblems({
      repositoryRoot: root,
      config: defaultConfig,
      write: false,
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("境界の内側が古いと報告する", async () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/example/package.json": DESCRIBED_MANIFEST,
      "docs/workspaces.md": `# ワークスペース\n\n${BEGIN}\n\n古い内容\n\n${END}\n`,
    });

    const problems = await workspaceListProblems({
      repositoryRoot: root,
      config: defaultConfig,
      write: false,
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("書き込む様態では境界の内側が生成結果になる", async () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/example/package.json": DESCRIBED_MANIFEST,
      "docs/workspaces.md": `# ワークスペース\n\n${BEGIN}\n\n古い内容\n\n${END}\n`,
    });

    await workspaceListProblems({ repositoryRoot: root, config: defaultConfig, write: true });

    expect(readFileSync(join(root, "docs/workspaces.md"), "utf8")).toContain(
      "- `packages/example` — 説明",
    );
  });

  test("説明の無いワークスペースがあると生成の失敗として報告する", async () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/example/package.json": JSON.stringify({ name: "example" }),
      "docs/workspaces.md": `# ワークスペース\n\n${BEGIN}\n\n${END}\n`,
    });

    const problems = await workspaceListProblems({
      repositoryRoot: root,
      config: defaultConfig,
      write: false,
    });

    expect(problems.length).toStrictEqual(1);
  });
});
