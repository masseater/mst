import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { tsconfigScopeProblemsOf } from "./tsconfig-scope.ts";

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

const problemsIn = async (files: Readonly<Record<string, string>>): Promise<readonly string[]> => {
  const repositoryRoot = await repositoryWith(files);
  const problems = await tsconfigScopeProblemsOf({
    repositoryRoot,
    workspaceDirectory: join(repositoryRoot, "packages/repository-checks"),
  });
  return problems.map((problem) => problem.message);
};

describe("tsconfigScopeProblemsOf", () => {
  test("accepts a tsconfig that only extends a preset", async () => {
    await expect(
      problemsIn({ "packages/repository-checks/tsconfig.json": '{ "extends": "preset" }' }),
    ).resolves.toStrictEqual([]);
  });

  test("reports a tsconfig that narrows with include", async () => {
    await expect(
      problemsIn({ "packages/repository-checks/tsconfig.json": '{ "include": ["src"] }' }),
    ).resolves.toStrictEqual([expect.stringContaining("with include")]);
  });

  test("reports a tsconfig that narrows with files", async () => {
    await expect(
      problemsIn({ "packages/repository-checks/tsconfig.json": '{ "files": ["src/index.ts"] }' }),
    ).resolves.toStrictEqual([expect.stringContaining("with files")]);
  });

  test("reports a tsconfig that narrows with exclude", async () => {
    await expect(
      problemsIn({ "packages/repository-checks/tsconfig.json": '{ "exclude": ["specs"] }' }),
    ).resolves.toStrictEqual([expect.stringContaining("with exclude")]);
  });

  test("reads comments in a tsconfig without failing", async () => {
    await expect(
      problemsIn({
        "packages/repository-checks/tsconfig.json": '{\n  // note\n  "include": ["src"]\n}',
      }),
    ).resolves.toStrictEqual([expect.stringContaining("with include")]);
  });

  test("falls back to the repository tsconfig when the workspace has none", async () => {
    await expect(problemsIn({ "tsconfig.json": '{ "include": ["src"] }' })).resolves.toStrictEqual([
      expect.stringContaining("with include"),
    ]);
  });

  test("stays silent when no tsconfig governs the workspace", async () => {
    await expect(problemsIn({})).resolves.toStrictEqual([]);
  });

  test("stays silent for a tsconfig that does not parse into a mapping", async () => {
    await expect(
      problemsIn({ "packages/repository-checks/tsconfig.json": '["not a mapping"]' }),
    ).resolves.toStrictEqual([]);
  });

  test("names the tsconfig file relative to the repository root", async () => {
    const repositoryRoot = await repositoryWith({
      "packages/repository-checks/tsconfig.json": '{ "include": ["src"] }',
    });
    const problems = await tsconfigScopeProblemsOf({
      repositoryRoot,
      workspaceDirectory: join(repositoryRoot, "packages/repository-checks"),
    });
    expect(problems.map((problem) => problem.file)).toStrictEqual([
      "packages/repository-checks/tsconfig.json",
    ]);
  });
});
