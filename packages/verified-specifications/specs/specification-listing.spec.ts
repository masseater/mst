import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runVerifiedSpecifications } from "../src/run-cli.ts";

const SPEC_SOURCE = `describe("行の結合", () => {
  it("各要素を畳む", () => {});
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

describe("仕様一覧の鮮度", () => {
  it("仕様担保テストの主張と食い違う一覧を報告して失敗する", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
      "specs/joining.spec.ts": SPEC_SOURCE,
      "SPECIFICATIONS.md": "# stale\n",
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.exitCode).not.toBe(0);
    expect(finished.out).toContain("SPECIFICATIONS.md");
  });

  it("書き込みの様態では一覧を主張どおりに書き直す", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
      "specs/joining.spec.ts": SPEC_SOURCE,
    });
    await runVerifiedSpecifications(["check", "--repository-root", repositoryRoot, "--write"]);
    const written = await readFile(join(repositoryRoot, "SPECIFICATIONS.md"), "utf-8");
    expect(written).toContain("- 各要素を畳む");
  });

  it("主張と一致する一覧を黙って通す", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
      "specs/joining.spec.ts": SPEC_SOURCE,
    });
    await runVerifiedSpecifications(["check", "--repository-root", repositoryRoot, "--write"]);
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished).toStrictEqual({ exitCode: 0, out: "", error: "" });
  });

  it("仕様担保テストが消えたのに残った一覧を報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
      "SPECIFICATIONS.md": "# orphan\n",
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toContain("must not outlive");
  });
});

describe("仕様担保テストの構造", () => {
  it("計算された名前を持つ主張を報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
      "specs/joining.spec.ts": 'describe("s", () => {\n  it(`c${"x"}`, () => {});\n});\n',
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toContain("computed name");
  });

  it("test 関数で書かれた主張を報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
      "specs/joining.spec.ts": 'describe("s", () => {\n  test("c", () => {});\n});\n',
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toContain("Replace test with it");
  });
});
