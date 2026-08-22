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
    Object.entries(files).map(async ([fileName, source]) => {
      const absolutePath = join(repositoryRoot, fileName);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

describe("ワークスペースの走査", () => {
  it("ワークスペース定義に載る場所だけを走査する", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/listed/package.json": '{ "name": "listed" }',
      "packages/listed/specs/login.spec.ts": SPEC_SOURCE,
      "elsewhere/package.json": '{ "name": "unlisted" }',
      "elsewhere/specs/login.spec.ts": SPEC_SOURCE,
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toContain("packages/listed/SPECIFICATIONS.md");
    expect(finished.out).not.toContain("elsewhere");
  });

  it("名前の無い package.json を報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/nameless/package.json": '{ "private": true }',
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toContain("must not go without a name");
  });

  it("ワークスペース定義が無ければ、リポジトリ自身を 1 つのワークスペースとして扱う", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
      "specs/login.spec.ts": SPEC_SOURCE,
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toContain("SPECIFICATIONS.md");
  });

  it("specs の外に置かれた .spec.ts を主張として数えない", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
      "src/hidden.spec.ts": SPEC_SOURCE,
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished).toStrictEqual({ exitCode: 0, out: "", error: "" });
  });
});
