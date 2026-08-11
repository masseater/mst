import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

const reportedFor = async (specSource: string): Promise<string> => {
  const repositoryRoot = await repositoryWith({
    "package.json": '{ "name": "demo-package" }',
    "specs/login.spec.ts": specSource,
  });
  const finished = await runVerifiedSpecifications(["check", "--repository-root", repositoryRoot]);
  return finished.out;
};

describe("仕様担保テストの構造", () => {
  it("計算された名前を持つ主張を報告する", async () => {
    const reported = await reportedFor('describe("s", () => {\n  it(`c${"x"}`, () => {});\n});\n');
    expect(reported).toContain("computed name");
  });

  it("test 関数で書かれた主張を報告する", async () => {
    const reported = await reportedFor('describe("s", () => {\n  test("c", () => {});\n});\n');
    expect(reported).toContain("Replace test with it");
  });

  it("each や skip で絞られた宣言を報告する", async () => {
    const reported = await reportedFor(
      'describe("s", () => {\n  it.each([1])("c %i", () => {});\n});\n',
    );
    expect(reported).toContain("must not be narrowed through a member");
  });

  it("主張を 1 つも持たない describe を報告する", async () => {
    const reported = await reportedFor('describe("s", () => {});\n');
    expect(reported).toContain("must not stand without claims");
  });

  it("最上位の describe を持たないファイルを報告する", async () => {
    const reported = await reportedFor("const nothing = 1;\n");
    expect(reported).toContain("must not go without a top-level describe");
  });

  it("構文として読めないファイルを報告する", async () => {
    const reported = await reportedFor("describe(\n");
    expect(reported).toContain("must parse as TypeScript");
  });

  it("構造に問題がある間は一覧を書き換えない", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "demo-package" }',
      "specs/login.spec.ts": 'describe("s", () => {});\n',
      "SPECIFICATIONS.md": "# untouched\n",
    });
    await runVerifiedSpecifications(["check", "--repository-root", repositoryRoot, "--write"]);
    await expect(readFile(join(repositoryRoot, "SPECIFICATIONS.md"), "utf-8")).resolves.toBe(
      "# untouched\n",
    );
  });
});
