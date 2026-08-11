import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runVerifiedSpecifications } from "../src/run-cli.ts";

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
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

describe("検査の入口", () => {
  it("check 以外の命令に使い方を返して失敗する", async () => {
    const finished = await runVerifiedSpecifications(["deploy"]);
    expect(finished.exitCode).not.toBe(0);
    expect(finished.error).toContain("Usage:");
  });

  it("知らない引数を誤用として失敗させる", async () => {
    const finished = await runVerifiedSpecifications(["check", "--unknown-option"]);
    expect(finished.exitCode).not.toBe(0);
    expect(finished.error).toContain("--unknown-option");
  });

  it("問題が無ければ何も出力せず成功で終わる", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "demo-package" }',
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished).toStrictEqual({ exitCode: 0, out: "", error: "" });
  });

  it("問題を 1 件 1 行で、ファイルと行の位置から書き始める", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "demo-package" }',
      "specs/login.spec.ts": 'describe("s", () => {\n  test("c", () => {});\n});\n',
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toMatch(/^specs\/login\.spec\.ts:2 /u);
  });
});
