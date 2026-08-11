import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runVerifiedSpecifications } from "../src/run-cli.ts";

const SPEC_SOURCE = `describe("ログイン", () => {
  it("正しい資格情報でセッションを発行する", () => {});
});
`;

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

describe("検査対象を絞る tsconfig の検出", () => {
  it("include で検査対象を絞った tsconfig を報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "demo-package" }',
      "specs/login.spec.ts": SPEC_SOURCE,
      "tsconfig.json": '{ "include": ["src"] }',
    });
    await runVerifiedSpecifications(["check", "--repository-root", repositoryRoot, "--write"]);
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toContain("must not narrow the files it checks with include");
  });

  it("files や exclude による絞り込みも同じように報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "demo-package" }',
      "specs/login.spec.ts": SPEC_SOURCE,
      "tsconfig.json": '{ "files": ["src/index.ts"], "exclude": ["specs"] }',
    });
    await runVerifiedSpecifications(["check", "--repository-root", repositoryRoot, "--write"]);
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toContain("with files");
    expect(finished.out).toContain("with exclude");
  });

  it("ワークスペースに tsconfig が無ければ、リポジトリの tsconfig を見る", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "tsconfig.json": '{ "include": ["packages"] }',
      "packages/listed/package.json": '{ "name": "listed" }',
      "packages/listed/specs/login.spec.ts": SPEC_SOURCE,
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toContain("must not narrow the files it checks with include");
  });

  it("仕様担保テストの無いワークスペースの tsconfig は見ない", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "demo-package" }',
      "tsconfig.json": '{ "include": ["src"] }',
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished).toStrictEqual({ exitCode: 0, out: "", error: "" });
  });
});
