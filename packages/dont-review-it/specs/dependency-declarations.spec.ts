import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { EXIT_PROBLEMS_FOUND, EXIT_SUCCESS } from "@mst/utils";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runDontReviewIt } from "../src/run-cli.ts";

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-dependencies-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([name, source]) => {
      const target = join(repositoryRoot, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

describe("依存宣言の検査", () => {
  it("ワークスペース定義の無いリポジトリでは依存を検査しない", async () => {
    const repositoryRoot = await repositoryWith({
      "packages/web/package.json": `{"devDependencies": {"typescript": "^5.0.0"}}`,
      "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
    });
    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);
    expect(finished).toStrictEqual({ exitCode: EXIT_SUCCESS, out: "", error: "" });
  });

  it("解釈できないワークスペース定義を、どの検査も素通りする前に報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages: [packages/*\n",
    });
    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);
    expect(finished.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(finished.out).toContain("must not stay in the repository");
  });

  it("1 つのマニフェストしか使わない catalog エントリを報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      "packages/web/package.json": `{"dependencies": {"react": "catalog:"}}`,
    });
    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);
    expect(finished.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(finished.out).toContain("The catalog must not hold react");
  });

  it("overrides が catalog: で参照するエントリは、使うマニフェストが 1 つでも通す", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": `packages:
  - packages/*
catalog:
  vite: ^7.0.0
overrides:
  vite: "catalog:"
`,
      "packages/web/package.json": `{"devDependencies": {"vite": "catalog:"}}`,
    });
    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);
    expect(finished).toStrictEqual({ exitCode: EXIT_SUCCESS, out: "", error: "" });
  });

  it("catalog が持つバージョンをマニフェストが直接書き写していたら報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  typescript: ^5.5.0\n",
      "packages/web/package.json": `{"devDependencies": {"typescript": "catalog:"}}`,
      "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
    });
    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);
    expect(finished.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(finished.out).toContain("must not carry ^5.5.0 directly");
  });

  it("複数のマニフェストが catalog の外で同じバージョンを繰り返していたら報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/web/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
      "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
    });
    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);
    expect(finished.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(finished.out).toContain("must not be pinned to ^5.5.0 separately");
  });

  it("バージョンが食い違う宣言は警告に留め、検査を失敗させない", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/web/package.json": `{"devDependencies": {"typescript": "^5.0.0"}}`,
      "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
    });
    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);
    expect(finished.exitCode).toBe(EXIT_SUCCESS);
    expect(finished.out).toContain("warning:");
    expect(finished.out).toContain("pinned to different specifiers");
  });
});
