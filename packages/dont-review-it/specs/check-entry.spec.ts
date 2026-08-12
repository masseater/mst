import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND } from "@mst/repository-checks";
import { runCommand } from "citty";
import { describe, expect, onTestFinished, it } from "vite-plus/test";

import { dontReviewItCommand } from "../src/dont-review-it-command.ts";
import { runChecks } from "../src/run-checks.ts";

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
  it("check 以外の命令を名指しで拒否する", async () => {
    await expect(runCommand(dontReviewItCommand, { rawArgs: ["deploy"] })).rejects.toThrow(
      /Unknown command/u,
    );
  });

  it("存在しない場所を検査対象に取らない", async () => {
    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", "/nonexistent/verified-specifications-probe"],
    });

    expect(process.exitCode).toBe(EXIT_MISUSE);
    process.exitCode = 0;
  });

  it("依存バージョンの食い違いを報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      "packages/legacy/package.json": `{"dependencies": {"react": "^18.0.0"}}`,
      "packages/site/package.json": `{"dependencies": {"react": "catalog:"}, "devDependencies": {"typescript": "^5.5.0"}}`,
      "packages/web/package.json": `{"dependencies": {"react": "catalog:"}, "devDependencies": {"typescript": "^5.0.0"}}`,
    });

    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("react is pinned to ^18.0.0 here while the catalog pins ^19.0.0");
    expect(reported).toContain("typescript is pinned to different specifiers");

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("test command が config を差し替える経路を報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": `{"private": true, "scripts": {"test": "vp test --config arbitrary.ts"}}`,
    });

    expect(runChecks(repositoryRoot).problems.join("\n")).toContain(
      "The test script must not select a test config with `--config` or `-c`",
    );

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("test command が coverage 設定を上書きするか対象を変更ファイルだけに絞る経路を報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"private": true, "scripts": {"override": "vp test --coverage --coverage.exclude=src/**", "changed": "vp test --changed HEAD"}}`,
    });

    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("must not override coverage settings");
    expect(reported).toContain("reduce the coverage source universe");

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });
});
