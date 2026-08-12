import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runVerifiedSpecifications } from "../src/run-cli.ts";

const SPEC_SOURCE = `describe("ログイン", () => {
  it("正しい資格情報でセッションを発行する", () => {});
  it("誤ったパスワードを繰り返すと施錠する", () => {});
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

const writtenListOf = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await repositoryWith({
    "package.json": '{ "name": "demo-package" }',
    ...files,
  });
  await runVerifiedSpecifications(["check", "--repository-root", repositoryRoot, "--write"]);
  return readFile(join(repositoryRoot, "SPECIFICATIONS.md"), "utf-8");
};

describe("仕様一覧の生成", () => {
  it("一覧の題をパッケージの名前にする", async () => {
    const written = await writtenListOf({ "specs/login.spec.ts": SPEC_SOURCE });
    expect(written).toContain("# demo-package\n");
  });

  it("describe の名前を見出しに、it の名前を箇条書きにする", async () => {
    const written = await writtenListOf({ "specs/login.spec.ts": SPEC_SOURCE });
    expect(written).toContain("## ログイン\n");
    expect(written).toContain(
      "- 正しい資格情報でセッションを発行する\n- 誤ったパスワードを繰り返すと施錠する\n",
    );
  });

  it("主題の下に、その主張を検証している spec ファイルへのリンクを挿す", async () => {
    const written = await writtenListOf({ "specs/login.spec.ts": SPEC_SOURCE });
    expect(written).toContain("## ログイン\n\n[`specs/login.spec.ts`](specs/login.spec.ts)\n");
  });

  it("同じ主題を宣言した複数のファイルを 1 つの見出しに畳み、全ファイルへリンクする", async () => {
    const written = await writtenListOf({
      "specs/issuing.spec.ts": 'describe("ログイン", () => {\n  it("発行する", () => {});\n});\n',
      "specs/locking.spec.ts": 'describe("ログイン", () => {\n  it("施錠する", () => {});\n});\n',
    });
    expect(written.match(/## ログイン/gu)).toHaveLength(1);
    expect(written).toContain("- 発行する\n- 施錠する\n");
    expect(written).toContain(
      "[`specs/issuing.spec.ts`](specs/issuing.spec.ts), [`specs/locking.spec.ts`](specs/locking.spec.ts)",
    );
  });

  it("主題をファイル名の順に並べる", async () => {
    const written = await writtenListOf({
      "specs/first.spec.ts":
        'describe("ベータ", () => {\n  it("先のファイルの主張", () => {});\n});\n',
      "specs/second.spec.ts":
        'describe("アルファ", () => {\n  it("後のファイルの主張", () => {});\n});\n',
    });
    expect(written.indexOf("## ベータ")).toBeLessThan(written.indexOf("## アルファ"));
  });

  it("一覧の先頭に、生成物であり手で編集しないことを書く", async () => {
    const written = await writtenListOf({ "specs/login.spec.ts": SPEC_SOURCE });
    expect(written).toContain("生成物");
    expect(written).toContain("手で編集しない");
  });
});

describe("仕様一覧の鮮度", () => {
  it("仕様担保テストの主張と食い違う一覧を報告して失敗する", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "demo-package" }',
      "specs/login.spec.ts": SPEC_SOURCE,
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
    const written = await writtenListOf({ "specs/login.spec.ts": SPEC_SOURCE });
    expect(written).toContain("- 正しい資格情報でセッションを発行する");
  });

  it("主張と一致する一覧を黙って通す", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "demo-package" }',
      "specs/login.spec.ts": SPEC_SOURCE,
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
      "package.json": '{ "name": "demo-package" }',
      "SPECIFICATIONS.md": "# orphan\n",
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.out).toContain("must not outlive");
  });

  it("書き込みの様態では、残った一覧を削除する", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "demo-package" }',
      "SPECIFICATIONS.md": "# orphan\n",
    });
    await runVerifiedSpecifications(["check", "--repository-root", repositoryRoot, "--write"]);
    await expect(stat(join(repositoryRoot, "SPECIFICATIONS.md"))).rejects.toThrow("ENOENT");
  });

  it("仕様担保テストの無いワークスペースに一覧を要求しない", async () => {
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
});
