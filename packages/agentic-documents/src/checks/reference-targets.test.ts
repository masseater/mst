import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { brokenReferences } from "./reference-targets.ts";

const rootWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "agentic-documents-references-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });

  for (const [path, text] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }

  return root;
};

const referenceProblemsIn = ({
  repositoryRoot,
  source,
}: {
  readonly repositoryRoot: string;
  readonly source: string;
}) =>
  brokenReferences({
    repositoryRoot,
    document: toNormativeDocument({ file: "AGENTS.md", source, config: defaultConfig }),
    config: defaultConfig,
  });

describe("brokenReferences", () => {
  test("コード表記のリポジトリ相対パスは参照として辿る", async () => {
    const problems = await referenceProblemsIn({
      repositoryRoot: rootWith({ "docs/rules.md": "# 規約\n" }),
      source: "`docs/rules.md` と `rules.md` を読む\n",
    });

    expect(problems).toStrictEqual([]);
  });

  test("コード表記のリポジトリ相対パスが実在しないと報告する", async () => {
    const problems = await referenceProblemsIn({
      repositoryRoot: rootWith({}),
      source: "`docs/rules.md` を読む\n",
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("印を伴う指し先も参照として辿る", async () => {
    const problems = await referenceProblemsIn({
      repositoryRoot: rootWith({}),
      source: "詳細は @docs/rules.md を読む\n",
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("読み解けない綴りの見出し指定はそのまま見出し名として扱う", async () => {
    const problems = await referenceProblemsIn({
      repositoryRoot: rootWith({ "docs/rules.md": "# 規約\n" }),
      source: "詳しくは [規約](docs/rules.md#%E0%A4%A) を読む\n",
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("末尾の井桁だけの参照は見出しを指していない", async () => {
    const problems = await referenceProblemsIn({
      repositoryRoot: rootWith({ "docs/rules.md": "# 規約\n" }),
      source: "詳しくは [規約](docs/rules.md#) を読む\n",
    });

    expect(problems).toStrictEqual([]);
  });

  test("実在しない文書への参照を報告する", async () => {
    const problems = await referenceProblemsIn({
      repositoryRoot: rootWith({}),
      source: "詳しくは [規約](docs/rules.md) を読む\n",
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("実在する文書への参照は報告しない", async () => {
    const problems = await referenceProblemsIn({
      repositoryRoot: rootWith({ "docs/rules.md": "# 規約\n" }),
      source: "詳しくは [規約](docs/rules.md) を読む\n",
    });

    expect(problems).toStrictEqual([]);
  });

  test("実在しない見出しを指す参照を報告する", async () => {
    const problems = await referenceProblemsIn({
      repositoryRoot: rootWith({ "docs/rules.md": "# 規約\n\n## 書き方\n" }),
      source: "詳しくは [規約](docs/rules.md#存在しない見出し) を読む\n",
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("実在する見出しを指す参照は報告しない", async () => {
    const problems = await referenceProblemsIn({
      repositoryRoot: rootWith({ "docs/rules.md": "# 規約\n\n## 書き方\n" }),
      source: "詳しくは [規約](docs/rules.md#書き方) を読む\n",
    });

    expect(problems).toStrictEqual([]);
  });

  test("リポジトリの外を指す参照は報告しない", async () => {
    const problems = await referenceProblemsIn({
      repositoryRoot: rootWith({}),
      source: "詳しくは [外部](https://example.com/rules.md) を読む\n",
    });

    expect(problems).toStrictEqual([]);
  });
});
