import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { missingNormativeDocuments } from "./normative-document-coverage.ts";

const DESCRIBED_MANIFEST = JSON.stringify({ name: "example", description: "説明" });

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const repositoryOf = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
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

const coverageProblemsIn = (repositoryRoot: string) =>
  missingNormativeDocuments({ repositoryRoot, config: defaultConfig });

describe("missingNormativeDocuments", () => {
  test("規範文書を持たないワークスペースを報告する", async () => {
    const root = repositoryOf({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "AGENTS.md": "# 規約\n",
      "packages/example/package.json": DESCRIBED_MANIFEST,
    });

    const problems = await coverageProblemsIn(root);

    expect(problems.map((problem) => problem.file)).toStrictEqual(["packages/example/AGENTS.md"]);
  });

  test("リポジトリのルートに規範文書が無いことを報告する", async () => {
    const root = repositoryOf({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/example/package.json": DESCRIBED_MANIFEST,
      "packages/example/AGENTS.md": "# 規約\n",
    });

    const problems = await coverageProblemsIn(root);

    expect(problems.map((problem) => problem.file)).toStrictEqual(["AGENTS.md"]);
  });

  test("すべての場所が規範文書を持てば報告しない", async () => {
    const root = repositoryOf({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "AGENTS.md": "# 規約\n",
      "packages/example/package.json": DESCRIBED_MANIFEST,
      "packages/example/AGENTS.md": "# 規約\n",
    });

    expect(await coverageProblemsIn(root)).toStrictEqual([]);
  });

  test("マニフェストを持たない位置は作業の単位ではないので報告しない", async () => {
    const root = repositoryOf({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "AGENTS.md": "# 規約\n",
      "packages/not-a-workspace/readme.txt": "マニフェストが無い\n",
    });

    expect(await coverageProblemsIn(root)).toStrictEqual([]);
  });

  test("ワークスペースとして宣言されていないディレクトリは報告しない", async () => {
    const root = repositoryOf({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "AGENTS.md": "# 規約\n",
      "tools/helper/package.json": DESCRIBED_MANIFEST,
    });

    expect(await coverageProblemsIn(root)).toStrictEqual([]);
  });
});
