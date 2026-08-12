import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { companionFileProblems } from "./companion-files.ts";

const NORMATIVE_SOURCE = "# 規約\n";

const it = test
  .extend("problemsForANestedDocumentWithoutACompanion", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);

    return companionFileProblems({
      repositoryRoot: root,
      documents: [
        toNormativeDocument({
          file: "packages/example/AGENTS.md",
          source: NORMATIVE_SOURCE,
          config: defaultConfig,
        }),
      ],
      config: defaultConfig,
    });
  })
  .extend("problemsForARootDocumentWithoutACompanion", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);

    return companionFileProblems({
      repositoryRoot: root,
      documents: [
        toNormativeDocument({ file: "AGENTS.md", source: NORMATIVE_SOURCE, config: defaultConfig }),
      ],
      config: defaultConfig,
    });
  })
  .extend("problemsForALinkPointingAtTheNormativeDocument", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);
    symlinkSync("AGENTS.md", join(root, "CLAUDE.md"));

    return companionFileProblems({
      repositoryRoot: root,
      documents: [
        toNormativeDocument({ file: "AGENTS.md", source: NORMATIVE_SOURCE, config: defaultConfig }),
      ],
      config: defaultConfig,
    });
  })
  .extend("problemsForALinkPointingElsewhere", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);
    symlinkSync("README.md", join(root, "CLAUDE.md"));

    return companionFileProblems({
      repositoryRoot: root,
      documents: [
        toNormativeDocument({ file: "AGENTS.md", source: NORMATIVE_SOURCE, config: defaultConfig }),
      ],
      config: defaultConfig,
    });
  })
  .extend("problemsForARegularFileCarryingABody", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);
    writeFileSync(join(root, "CLAUDE.md"), "# 別の規約\n\n中身がある。\n");

    return companionFileProblems({
      repositoryRoot: root,
      documents: [
        toNormativeDocument({ file: "AGENTS.md", source: NORMATIVE_SOURCE, config: defaultConfig }),
      ],
      config: defaultConfig,
    });
  })
  .extend("problemsForARegularFileCarryingAPointerOnly", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);
    writeFileSync(join(root, "CLAUDE.md"), "@AGENTS.md\n");

    return companionFileProblems({
      repositoryRoot: root,
      documents: [
        toNormativeDocument({ file: "AGENTS.md", source: NORMATIVE_SOURCE, config: defaultConfig }),
      ],
      config: defaultConfig,
    });
  });

describe("companionFileProblems", () => {
  it("入れ子の文書の対応ファイルはその階層で探す", ({
    problemsForANestedDocumentWithoutACompanion,
  }) => {
    expect(problemsForANestedDocumentWithoutACompanion).toStrictEqual([
      {
        file: "packages/example/CLAUDE.md",
        line: null,
        message:
          "規範文書の隣に `CLAUDE.md` が無い。この名前を期待して読む主体には指示が届かない。規範文書への結び付きとして作る。",
      },
    ]);
  });

  it("対応ファイルが無いと報告する", ({ problemsForARootDocumentWithoutACompanion }) => {
    expect(problemsForARootDocumentWithoutACompanion).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "規範文書の隣に `CLAUDE.md` が無い。この名前を期待して読む主体には指示が届かない。規範文書への結び付きとして作る。",
      },
    ]);
  });

  it("結び付きが規範文書を指していれば報告しない", ({
    problemsForALinkPointingAtTheNormativeDocument,
  }) => {
    expect(problemsForALinkPointingAtTheNormativeDocument).toStrictEqual([]);
  });

  it("結び付きの指し先が違うと報告する", ({ problemsForALinkPointingElsewhere }) => {
    expect(problemsForALinkPointingElsewhere).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "`CLAUDE.md` の結び付きが `README.md` を指しており、隣の規範文書ではない。同じ場所の規範文書を指すよう作り直す。",
      },
    ]);
  });

  it("中身を持つ通常のファイルを報告する", ({ problemsForARegularFileCarryingABody }) => {
    expect(problemsForARegularFileCarryingABody).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "`CLAUDE.md` が通常のファイルとして中身を持っている。同じ指示の実体が 2 つある状態になる。中身を規範文書へ移してから、規範文書への結び付きに置き換える。",
      },
    ]);
  });

  it("参照 1 つだけのファイルも報告する", ({ problemsForARegularFileCarryingAPointerOnly }) => {
    expect(problemsForARegularFileCarryingAPointerOnly).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "`CLAUDE.md` が規範文書を指す参照 1 つだけを中身として持っている。読み手によっては参照として解釈されず、その 1 行だけが指示として読まれる。規範文書への結び付きに置き換える。",
      },
    ]);
  });
});
