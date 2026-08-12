import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runChecks } from "../src/run-checks.ts";

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-dependencies-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([fileName, source]) => {
      const absolutePath = join(repositoryRoot, fileName);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, source, "utf-8");
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
    const { problems, warnings, failures } = runChecks(repositoryRoot);

    expect(problems).toStrictEqual([]);
    expect(warnings).toStrictEqual([]);
    expect(failures).toStrictEqual([]);
  });

  it("解釈できないワークスペース定義を、どの検査も素通りする前に報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages: [packages/*\n",
    });
    const { problems } = runChecks(repositoryRoot);
    expect(problems.join("\n")).toContain("must not stay in the repository");
  });

  it("1 つのマニフェストしか使わない catalog エントリを報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      "packages/web/package.json": `{"dependencies": {"react": "catalog:"}}`,
    });
    const { problems } = runChecks(repositoryRoot);
    expect(problems.join("\n")).toContain("The catalog must not hold react");
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
    const { problems, warnings, failures } = runChecks(repositoryRoot);

    expect(problems).toStrictEqual([]);
    expect(warnings).toStrictEqual([]);
    expect(failures).toStrictEqual([]);
  });

  it("catalog が持つバージョンをマニフェストが直接書き写していたら報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  typescript: ^5.5.0\n",
      "packages/web/package.json": `{"devDependencies": {"typescript": "catalog:"}}`,
      "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
    });
    const { problems } = runChecks(repositoryRoot);
    expect(problems.join("\n")).toContain("must not carry ^5.5.0 directly");
  });

  it("複数のマニフェストが catalog の外で同じバージョンを繰り返していたら報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/web/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
      "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
    });
    const { problems } = runChecks(repositoryRoot);
    expect(problems.join("\n")).toContain("must not be pinned to ^5.5.0 separately");
  });

  it("バージョンが食い違う宣言は警告に留め、検査を失敗させない", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/web/package.json": `{"devDependencies": {"typescript": "^5.0.0"}}`,
      "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
    });
    const { problems, warnings } = runChecks(repositoryRoot);
    expect(problems).toStrictEqual([]);
    expect(warnings.join("\n")).toContain("pinned to different specifiers");
  });
});
