import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { frontmatterProblems } from "./frontmatter-description.ts";

const MISSING_FRONTMATTER_MESSAGE =
  "規範文書に前置きが無い。文書の先頭に区切り行で囲んだ前置きを置き、必須の項目を書く。一覧を機械で組むために、説明が同じ位置に同じ形である必要がある。";

const it = test
  .extend("problemsForFrontmatterThatIsNotAMapping", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "example", description: "説明" }),
    );

    return frontmatterProblems({
      repositoryRoot: root,
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "---\n- 一覧\n---\n\n# 規約\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    });
  })
  .extend("problemsWhenNoFrontmatterFieldIsRequired", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "example", description: "説明" }),
    );

    return frontmatterProblems({
      repositoryRoot: root,
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "---\ndescription: 説明\n---\n\n# 規約\n",
        config: defaultConfig,
      }),
      config: { ...defaultConfig, requiredFrontmatterFields: [] },
    });
  })
  .extend("problemsForADocumentWithoutFrontmatter", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });

    return frontmatterProblems({
      repositoryRoot: root,
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "# 規約\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    });
  })
  .extend("problemsForARequiredFieldLeftEmpty", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });

    return frontmatterProblems({
      repositoryRoot: root,
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "---\ndescription: ''\n---\n\n# 規約\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    });
  })
  .extend("problemsForADescriptionDifferingFromTheManifest", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "example", description: "マニフェスト側の説明" }),
    );

    return frontmatterProblems({
      repositoryRoot: root,
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "---\ndescription: 前置き側の説明\n---\n\n# 規約\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    });
  })
  .extend("problemsForADescriptionMatchingTheManifest", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "example", description: "同じ説明" }),
    );

    return frontmatterProblems({
      repositoryRoot: root,
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "---\ndescription: 同じ説明\n---\n\n# 規約\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    });
  })
  .extend("problemsForADescriptionWithoutAManifest", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-frontmatter-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });

    return frontmatterProblems({
      repositoryRoot: root,
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "---\ndescription: 説明\n---\n\n# 規約\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    });
  });

describe("frontmatterProblems", () => {
  it("前置きが対応表でないと前置きが無いものとして報告する", ({
    problemsForFrontmatterThatIsNotAMapping,
  }) => {
    expect(problemsForFrontmatterThatIsNotAMapping).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: MISSING_FRONTMATTER_MESSAGE },
    ]);
  });

  it("必須の前置き項目が 1 つも無い設定では何も要求しない", ({
    problemsWhenNoFrontmatterFieldIsRequired,
  }) => {
    expect(problemsWhenNoFrontmatterFieldIsRequired).toStrictEqual([]);
  });

  it("前置きが無いと報告する", ({ problemsForADocumentWithoutFrontmatter }) => {
    expect(problemsForADocumentWithoutFrontmatter).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: MISSING_FRONTMATTER_MESSAGE },
    ]);
  });

  it("必須の項目が空だと報告する", ({ problemsForARequiredFieldLeftEmpty }) => {
    expect(problemsForARequiredFieldLeftEmpty).toStrictEqual([
      {
        file: "AGENTS.md",
        line: 1,
        message: "前置きの項目 `description` が無いか、値が空である。値を書く。",
      },
    ]);
  });

  it("マニフェストの説明と食い違うと報告する", ({
    problemsForADescriptionDifferingFromTheManifest,
  }) => {
    expect(problemsForADescriptionDifferingFromTheManifest).toStrictEqual([
      {
        file: "AGENTS.md",
        line: 1,
        message:
          '前置きの `description` とマニフェストの説明が一致していない。前置き: "前置き側の説明" / マニフェスト: "マニフェスト側の説明"。どちらが正しいかを決め、両方を同じ値に揃える。',
      },
    ]);
  });

  it("マニフェストの説明と一致すれば報告しない", ({
    problemsForADescriptionMatchingTheManifest,
  }) => {
    expect(problemsForADescriptionMatchingTheManifest).toStrictEqual([]);
  });

  it("マニフェストが無ければ前置きの検査だけを行う", ({
    problemsForADescriptionWithoutAManifest,
  }) => {
    expect(problemsForADescriptionWithoutAManifest).toStrictEqual([]);
  });
});
