import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runChecks } from "../src/run-checks.ts";

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
    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("src/twice.ts:1 (twice)");
    expect(reported).toContain("src/doubled.ts:1 (doubled)");
  });

  it("テストファイルが繰り返す本体を重複と数えない", async () => {
    const repositoryRoot = await repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/twice.test.ts": "export const doubled = (value: number): number => value * 2;\n",
    });
    expect(runChecks(repositoryRoot)).toStrictEqual({ problems: [], failures: [] });
  });
});
