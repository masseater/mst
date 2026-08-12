import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { missingNormativeDocuments } from "./normative-document-coverage.ts";

const DESCRIBED_MANIFEST = JSON.stringify({ name: "example", description: "説明" });

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const NORMATIVE_DOCUMENT = "# 規約\n";

const MISSING_DOCUMENT_MESSAGE =
  "この場所に `AGENTS.md` が無い。ここで作業する読み手は、固有の規約が無いのか書かれていないだけなのかを区別できない。この場所が守るものを書く。見出しだけの空の文書で通すと、無いことすら読み取れなくなる。";

const it = test
  .extend("problemsOfAWorkspaceWithoutItsOwnDocument", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
    writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
    writeFileSync(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf8");
    writeFileSync(
      join(repositoryRoot, "packages", "example", "package.json"),
      DESCRIBED_MANIFEST,
      "utf8",
    );
    return missingNormativeDocuments({ repositoryRoot, config: defaultConfig });
  })
  .extend("problemsOfARepositoryRootWithoutADocument", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
    writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
    writeFileSync(
      join(repositoryRoot, "packages", "example", "package.json"),
      DESCRIBED_MANIFEST,
      "utf8",
    );
    writeFileSync(
      join(repositoryRoot, "packages", "example", "AGENTS.md"),
      NORMATIVE_DOCUMENT,
      "utf8",
    );
    return missingNormativeDocuments({ repositoryRoot, config: defaultConfig });
  })
  .extend("problemsOfARepositoryWhereEveryLocationIsCovered", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "packages", "example"), { recursive: true });
    writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
    writeFileSync(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf8");
    writeFileSync(
      join(repositoryRoot, "packages", "example", "package.json"),
      DESCRIBED_MANIFEST,
      "utf8",
    );
    writeFileSync(
      join(repositoryRoot, "packages", "example", "AGENTS.md"),
      NORMATIVE_DOCUMENT,
      "utf8",
    );
    return missingNormativeDocuments({ repositoryRoot, config: defaultConfig });
  })
  .extend("problemsOfADirectoryWithoutAManifest", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "packages", "not-a-workspace"), { recursive: true });
    writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
    writeFileSync(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf8");
    writeFileSync(
      join(repositoryRoot, "packages", "not-a-workspace", "readme.txt"),
      "マニフェストが無い\n",
      "utf8",
    );
    return missingNormativeDocuments({ repositoryRoot, config: defaultConfig });
  })
  .extend("problemsOfADirectoryOutsideTheWorkspaceDefinition", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "agentic-documents-coverage-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "tools", "helper"), { recursive: true });
    writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
    writeFileSync(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf8");
    writeFileSync(
      join(repositoryRoot, "tools", "helper", "package.json"),
      DESCRIBED_MANIFEST,
      "utf8",
    );
    return missingNormativeDocuments({ repositoryRoot, config: defaultConfig });
  });

describe("missingNormativeDocuments", () => {
  it("規範文書を持たないワークスペースを報告する", ({
    problemsOfAWorkspaceWithoutItsOwnDocument,
  }) => {
    expect(problemsOfAWorkspaceWithoutItsOwnDocument).toStrictEqual([
      {
        file: "packages/example/AGENTS.md",
        line: null,
        message: MISSING_DOCUMENT_MESSAGE,
      },
    ]);
  });

  it("リポジトリのルートに規範文書が無いことを報告する", ({
    problemsOfARepositoryRootWithoutADocument,
  }) => {
    expect(problemsOfARepositoryRootWithoutADocument).toStrictEqual([
      { file: "AGENTS.md", line: null, message: MISSING_DOCUMENT_MESSAGE },
    ]);
  });

  it("すべての場所が規範文書を持てば報告しない", ({
    problemsOfARepositoryWhereEveryLocationIsCovered,
  }) => {
    expect(problemsOfARepositoryWhereEveryLocationIsCovered).toStrictEqual([]);
  });

  it("マニフェストを持たない位置は作業の単位ではないので報告しない", ({
    problemsOfADirectoryWithoutAManifest,
  }) => {
    expect(problemsOfADirectoryWithoutAManifest).toStrictEqual([]);
  });

  it("ワークスペースとして宣言されていないディレクトリは報告しない", ({
    problemsOfADirectoryOutsideTheWorkspaceDefinition,
  }) => {
    expect(problemsOfADirectoryOutsideTheWorkspaceDefinition).toStrictEqual([]);
  });
});
