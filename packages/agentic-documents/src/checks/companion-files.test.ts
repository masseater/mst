import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { companionFileProblems } from "./companion-files.ts";

const NORMATIVE_SOURCE = "# 規約\n";

const rootWithCompanion = (companion: {
  readonly kind: string;
  readonly body?: string;
}): string => {
  const root = mkdtempSync(join(tmpdir(), "agentic-documents-companion-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });

  writeFileSync(join(root, "AGENTS.md"), NORMATIVE_SOURCE);
  if (companion.kind === "link") symlinkSync("AGENTS.md", join(root, "CLAUDE.md"));
  if (companion.kind === "wrong-link") symlinkSync("README.md", join(root, "CLAUDE.md"));
  if (companion.kind === "file") writeFileSync(join(root, "CLAUDE.md"), companion.body ?? "");

  return root;
};

const problemsUnder = (repositoryRoot: string) =>
  companionFileProblems({
    repositoryRoot,
    documents: [
      toNormativeDocument({ file: "AGENTS.md", source: NORMATIVE_SOURCE, config: defaultConfig }),
    ],
    config: defaultConfig,
  });

describe("companionFileProblems", () => {
  test("対応ファイルが無いと報告する", async () => {
    expect((await problemsUnder(rootWithCompanion({ kind: "none" }))).length).toStrictEqual(1);
  });

  test("結び付きが規範文書を指していれば報告しない", async () => {
    expect(await problemsUnder(rootWithCompanion({ kind: "link" }))).toStrictEqual([]);
  });

  test("結び付きの指し先が違うと報告する", async () => {
    expect((await problemsUnder(rootWithCompanion({ kind: "wrong-link" }))).length).toStrictEqual(
      1,
    );
  });

  test("中身を持つ通常のファイルを報告する", async () => {
    const root = rootWithCompanion({ kind: "file", body: "# 別の規約\n\n中身がある。\n" });

    expect((await problemsUnder(root)).length).toStrictEqual(1);
  });

  test("参照 1 つだけのファイルも報告する", async () => {
    const root = rootWithCompanion({ kind: "file", body: "@AGENTS.md\n" });

    expect((await problemsUnder(root)).length).toStrictEqual(1);
  });
});
