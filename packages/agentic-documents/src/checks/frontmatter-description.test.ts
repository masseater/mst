import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { frontmatterProblems } from "./frontmatter-description.ts";

const rootWithManifest = (description: string | null): string => {
  const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  if (description !== null) {
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "example", description }));
  }
  return root;
};

const problemsFor = ({
  repositoryRoot,
  source,
}: {
  readonly repositoryRoot: string;
  readonly source: string;
}) =>
  frontmatterProblems({
    repositoryRoot,
    document: toNormativeDocument({ file: "AGENTS.md", source, config: defaultConfig }),
    config: defaultConfig,
  });

describe("frontmatterProblems", () => {
  test("前置きが無いと報告する", async () => {
    const problems = await problemsFor({
      repositoryRoot: rootWithManifest(null),
      source: "# 規約\n",
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("必須の項目が空だと報告する", async () => {
    const problems = await problemsFor({
      repositoryRoot: rootWithManifest(null),
      source: "---\ndescription: ''\n---\n\n# 規約\n",
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("マニフェストの説明と食い違うと報告する", async () => {
    const problems = await problemsFor({
      repositoryRoot: rootWithManifest("マニフェスト側の説明"),
      source: "---\ndescription: 前置き側の説明\n---\n\n# 規約\n",
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("マニフェストの説明と一致すれば報告しない", async () => {
    const problems = await problemsFor({
      repositoryRoot: rootWithManifest("同じ説明"),
      source: "---\ndescription: 同じ説明\n---\n\n# 規約\n",
    });

    expect(problems).toStrictEqual([]);
  });

  test("マニフェストが無ければ前置きの検査だけを行う", async () => {
    const problems = await problemsFor({
      repositoryRoot: rootWithManifest(null),
      source: "---\ndescription: 説明\n---\n\n# 規約\n",
    });

    expect(problems).toStrictEqual([]);
  });
});
