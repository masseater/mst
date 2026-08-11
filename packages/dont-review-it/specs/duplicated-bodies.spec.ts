import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { EXIT_PROBLEMS_FOUND, EXIT_SUCCESS } from "@mst/utils";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runDontReviewIt } from "../src/run-cli.ts";

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-bodies-"));
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

describe("重複した宣言本体の検査", () => {
  it("同じ本体を綴る宣言を、繰り返しているすべての場所を挙げて報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/doubled.ts": "export const doubled = (value: number): number => value * 2;\n",
    });
    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);
    expect(finished.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(finished.out).toContain("src/twice.ts:1 (twice)");
    expect(finished.out).toContain("src/doubled.ts:1 (doubled)");
  });

  it("テストファイルが繰り返す本体を重複と数えない", async () => {
    const repositoryRoot = await repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/twice.test.ts": "export const doubled = (value: number): number => value * 2;\n",
    });
    const finished = runDontReviewIt(["check", "--repository-root", repositoryRoot]);
    expect(finished).toStrictEqual({ exitCode: EXIT_SUCCESS, out: "", error: "" });
  });
});
