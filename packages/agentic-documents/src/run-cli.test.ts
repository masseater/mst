import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND, EXIT_SUCCESS } from "@mst/repository-checks";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runAgenticDocuments } from "./run-cli.ts";

const emptyRepository = async (): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "agentic-documents-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));
  return repositoryRoot;
};

const cleanRepository = async (): Promise<string> => {
  const repositoryRoot = await emptyRepository();
  await writeFile(
    join(repositoryRoot, "AGENTS.md"),
    "---\ndescription: A probe repository.\n---\n\n# probe\n\nこの場所の規約は無い。\n",
    "utf-8",
  );
  await symlink("AGENTS.md", join(repositoryRoot, "CLAUDE.md"));
  await writeFile(
    join(repositoryRoot, "package.json"),
    '{ "description": "A probe repository." }\n',
    "utf-8",
  );
  await mkdir(join(repositoryRoot, "docs"));
  await writeFile(
    join(repositoryRoot, "docs/workspaces.md"),
    "# ワークスペース\n\n<!-- BEGIN GENERATED workspaces -->\n<!-- END GENERATED workspaces -->\n",
    "utf-8",
  );
  return repositoryRoot;
};

describe("runAgenticDocuments", () => {
  it("turns an option it does not know into a misuse result", async () => {
    const finished = await runAgenticDocuments(["check", "--unknown-option"]);
    expect(finished.exitCode).toBe(EXIT_MISUSE);
    expect(finished.error).toContain("--unknown-option");
  });

  it("reports a repository that lacks its normative documents", async () => {
    const repositoryRoot = await emptyRepository();
    const finished = await runAgenticDocuments(["check", "--repository-root", repositoryRoot]);
    expect(finished.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(finished.out).toContain("AGENTS.md");
  });

  it("orders the problems of one document by line", async () => {
    const repositoryRoot = await cleanRepository();
    await writeFile(
      join(repositoryRoot, "AGENTS.md"),
      "---\ndescription: A probe repository.\n---\n\n# probe\n\n| a |\n| --- |\n| MUST: x |\n\n| b |\n| --- |\n| MUST: y |\n",
      "utf-8",
    );
    const finished = await runAgenticDocuments(["check", "--repository-root", repositoryRoot]);
    const lines = finished.out
      .split("\n")
      .filter((reported) => reported.startsWith("AGENTS.md:"))
      .map((reported) => Number(reported.split(" ")[0]?.split(":")[1]));
    expect(lines).toStrictEqual([...lines].toSorted((left, right) => left - right));
    expect(lines.length).toBeGreaterThan(1);
  });

  it("passes a repository whose documents satisfy every check", async () => {
    const repositoryRoot = await cleanRepository();
    const finished = await runAgenticDocuments(["check", "--repository-root", repositoryRoot]);
    expect(finished).toStrictEqual({ exitCode: EXIT_SUCCESS, out: "", error: "" });
  });

  it("scans the working directory when no root is named", async () => {
    const repositoryRoot = await cleanRepository();
    const launchDirectory = process.cwd();
    onTestFinished(() => {
      process.chdir(launchDirectory);
    });
    process.chdir(repositoryRoot);
    const finished = await runAgenticDocuments(["check"]);
    expect(finished.exitCode).toBe(EXIT_SUCCESS);
  });
});
