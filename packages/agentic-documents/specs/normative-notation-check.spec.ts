import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runAgenticDocuments } from "../src/run-cli.ts";

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "agentic-documents-"));
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

describe("規範文書の検査", () => {
  it("表の行に落とされた規範を報告して失敗する", async () => {
    const repositoryRoot = await repositoryWith({
      "AGENTS.md":
        "---\ndescription: a probe document.\n---\n\n# probe\n\n| rule |\n| --- |\n| MUST: x |\n",
    });
    const finished = await runAgenticDocuments(["check", "--repository-root", repositoryRoot]);
    expect(finished.exitCode).not.toBe(0);
    expect(finished.out).toContain("規範を表の行として書くことは禁止されている");
  });

  it("check 以外の命令に使い方を返して失敗する", async () => {
    const finished = await runAgenticDocuments(["deploy"]);
    expect(finished.exitCode).not.toBe(0);
    expect(finished.error).toContain("Usage:");
  });
});
