import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND, EXIT_SUCCESS } from "@mst/repository-checks";
import { describe, expect, test } from "vite-plus/test";

import { runAgenticDocuments } from "./run-cli.ts";

const NORMATIVE_DOCUMENT =
  "---\ndescription: A probe repository.\n---\n\n# probe\n\nこの場所の規約は無い。\n";

const NORMATIVE_DOCUMENT_CARRYING_TWO_TABLES =
  "---\ndescription: A probe repository.\n---\n\n# probe\n\n| a |\n| --- |\n| MUST: x |\n\n| b |\n| --- |\n| MUST: y |\n";

const PACKAGE_MANIFEST = '{ "description": "A probe repository." }\n';

const WORKSPACE_LIST =
  "# ワークスペース\n\n<!-- BEGIN GENERATED workspaces -->\n<!-- END GENERATED workspaces -->\n";

const USAGE = `Usage: agentic-documents <command> [options]

Commands:
  check   Report every place where a document disagrees with the repository or breaks the normative notation.

Options:
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
  --write                   Rewrite generated regions instead of reporting them as stale.
`;

describe("runAgenticDocuments", () => {
  describe("a run that names no command", () => {
    const it = test.extend("theRunWithoutACommand", () => runAgenticDocuments([]));

    it("exits as a misuse and prints what it can be asked to do", ({ theRunWithoutACommand }) => {
      expect(theRunWithoutACommand).toStrictEqual({
        exitCode: EXIT_MISUSE,
        out: "",
        error: USAGE,
      });
    });
  });

  describe("an option it does not know", () => {
    const it = test.extend("theRunOfAnUnknownOption", () =>
      runAgenticDocuments(["check", "--unknown-option"]));

    it("exits as a misuse and names the option it could not read", ({
      theRunOfAnUnknownOption,
    }) => {
      expect(theRunOfAnUnknownOption).toStrictEqual({
        exitCode: EXIT_MISUSE,
        out: "",
        error:
          "Unknown option '--unknown-option'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- \"--unknown-option\"\n",
      });
    });
  });

  describe("a repository that lacks its normative documents", () => {
    const it = test.extend("theRunOfARepositoryWithoutDocuments", async ({}, { onCleanup }) => {
      const repositoryRoot = await mkdtemp(join(tmpdir(), "agentic-documents-"));
      onCleanup(async () => rm(repositoryRoot, { recursive: true, force: true }));
      return runAgenticDocuments(["check", "--repository-root", repositoryRoot]);
    });

    it("reports every document the repository is missing", ({
      theRunOfARepositoryWithoutDocuments,
    }) => {
      expect(theRunOfARepositoryWithoutDocuments).toStrictEqual({
        exitCode: EXIT_PROBLEMS_FOUND,
        out: "AGENTS.md この場所に `AGENTS.md` が無い。ここで作業する読み手は、固有の規約が無いのか書かれていないだけなのかを区別できない。この場所が守るものを書く。見出しだけの空の文書で通すと、無いことすら読み取れなくなる。\ndocs/workspaces.md ワークスペースの一覧 `docs/workspaces.md` が無い。文書を作り、生成の境界を置く。境界の内側は機械が書くので、人は前後の散文だけを書く。\n",
        error: "",
      });
    });
  });

  describe("a document that carries two tables", () => {
    const it = test.extend("theRunOfADocumentCarryingTwoTables", async ({}, { onCleanup }) => {
      const repositoryRoot = await mkdtemp(join(tmpdir(), "agentic-documents-"));
      onCleanup(async () => rm(repositoryRoot, { recursive: true, force: true }));
      await writeFile(
        join(repositoryRoot, "AGENTS.md"),
        NORMATIVE_DOCUMENT_CARRYING_TWO_TABLES,
        "utf-8",
      );
      await symlink("AGENTS.md", join(repositoryRoot, "CLAUDE.md"));
      await writeFile(join(repositoryRoot, "package.json"), PACKAGE_MANIFEST, "utf-8");
      await mkdir(join(repositoryRoot, "docs"));
      await writeFile(join(repositoryRoot, "docs/workspaces.md"), WORKSPACE_LIST, "utf-8");
      return runAgenticDocuments(["check", "--repository-root", repositoryRoot]);
    });

    it("reports both of them, the earlier line first", ({ theRunOfADocumentCarryingTwoTables }) => {
      expect(theRunOfADocumentCarryingTwoTables).toStrictEqual({
        exitCode: EXIT_PROBLEMS_FOUND,
        out: "AGENTS.md:7 規範を表の行として書くことは禁止されている。各行を `IF: <条件>; THEN <キーワード>: <行動>` の項目に書き直す。規範ではない一覧であれば、規範文書の外へ移す。\nAGENTS.md:11 規範を表の行として書くことは禁止されている。各行を `IF: <条件>; THEN <キーワード>: <行動>` の項目に書き直す。規範ではない一覧であれば、規範文書の外へ移す。\n",
        error: "",
      });
    });
  });

  describe("a repository whose documents satisfy every check", () => {
    const it = test.extend("theRunOfASatisfyingRepository", async ({}, { onCleanup }) => {
      const repositoryRoot = await mkdtemp(join(tmpdir(), "agentic-documents-"));
      onCleanup(async () => rm(repositoryRoot, { recursive: true, force: true }));
      await writeFile(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf-8");
      await symlink("AGENTS.md", join(repositoryRoot, "CLAUDE.md"));
      await writeFile(join(repositoryRoot, "package.json"), PACKAGE_MANIFEST, "utf-8");
      await mkdir(join(repositoryRoot, "docs"));
      await writeFile(join(repositoryRoot, "docs/workspaces.md"), WORKSPACE_LIST, "utf-8");
      return runAgenticDocuments(["check", "--repository-root", repositoryRoot]);
    });

    it("exits clean with both streams empty", ({ theRunOfASatisfyingRepository }) => {
      expect(theRunOfASatisfyingRepository).toStrictEqual({
        exitCode: EXIT_SUCCESS,
        out: "",
        error: "",
      });
    });
  });

  describe("no repository root named", () => {
    const it = test.extend("theRunFromTheWorkingDirectory", async ({}, { onCleanup }) => {
      const repositoryRoot = await mkdtemp(join(tmpdir(), "agentic-documents-"));
      const launchDirectory = process.cwd();
      onCleanup(async () => {
        process.chdir(launchDirectory);
        await rm(repositoryRoot, { recursive: true, force: true });
      });
      await writeFile(join(repositoryRoot, "AGENTS.md"), NORMATIVE_DOCUMENT, "utf-8");
      await symlink("AGENTS.md", join(repositoryRoot, "CLAUDE.md"));
      await writeFile(join(repositoryRoot, "package.json"), PACKAGE_MANIFEST, "utf-8");
      await mkdir(join(repositoryRoot, "docs"));
      await writeFile(join(repositoryRoot, "docs/workspaces.md"), WORKSPACE_LIST, "utf-8");
      process.chdir(repositoryRoot);
      return runAgenticDocuments(["check"]);
    });

    it("scans the working directory and exits clean", ({ theRunFromTheWorkingDirectory }) => {
      expect(theRunFromTheWorkingDirectory).toStrictEqual({
        exitCode: EXIT_SUCCESS,
        out: "",
        error: "",
      });
    });
  });
});
