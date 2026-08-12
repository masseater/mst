import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND } from "@mst/utils";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runDontReviewIt } from "../src/run-cli.ts";

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "dont-review-it-spec-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  for (const [path, source] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source, "utf8");
  }
  return root;
};

describe("リポジトリ検査の入口", () => {
  it("check 以外の命令に使い方を返して失敗する", () => {
    const finished = runDontReviewIt(["deploy"]);
    expect(finished.exitCode).toBe(EXIT_MISUSE);
    expect(finished.error).toContain("Usage:");
  });

  it("存在しない場所を検査対象に取らない", () => {
    const finished = runDontReviewIt([
      "check",
      "--repository-root",
      "/nonexistent/verified-specifications-probe",
    ]);
    expect(finished.exitCode).toBe(EXIT_MISUSE);
    expect(finished.error).toContain("is not a directory");
  });

  it("依存バージョンの食い違いを報告して失敗する", () => {
    const repositoryRoot = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      "packages/legacy/package.json": `{"dependencies": {"react": "^18.0.0"}}`,
      "packages/site/package.json": `{"dependencies": {"react": "catalog:"}, "devDependencies": {"typescript": "^5.5.0"}}`,
      "packages/web/package.json": `{"dependencies": {"react": "catalog:"}, "devDependencies": {"typescript": "^5.0.0"}}`,
    });

    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);

    expect(finished.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(finished.out).toContain(
      "react is pinned to ^18.0.0 here while the catalog pins ^19.0.0",
    );
    expect(finished.out).toContain("typescript is pinned to different specifiers");
    expect(finished.out).not.toContain("warning:");
  });

  it("test command が config を差し替える経路を報告して失敗する", () => {
    const repositoryRoot = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": `{"scripts": {"test": "vp test --config arbitrary.ts"}}`,
    });

    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);

    expect(finished.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(finished.out).toContain(
      "The test script must not select a test config with `--config` or `-c`",
    );
  });

  it("test command が coverage 設定を上書きする経路を報告して失敗する", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"scripts": {"test": "vp test --coverage --coverage.exclude=src/**"}}`,
    });

    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);

    expect(finished.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(finished.out).toContain("must not override coverage settings on the command line");
  });
});
