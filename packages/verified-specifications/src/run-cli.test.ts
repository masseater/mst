import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND, EXIT_SUCCESS } from "@mst/repository-checks";
import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { runVerifiedSpecifications } from "./run-cli.ts";

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

describe("runVerifiedSpecifications", () => {
  test("prints the usage for a command it does not know", async () => {
    const finished = await runVerifiedSpecifications(["deploy"]);
    expect(finished.exitCode).toBe(EXIT_MISUSE);
    expect(finished.error).toContain("Usage:");
  });

  test("prints the usage when no command is given", async () => {
    const finished = await runVerifiedSpecifications([]);
    expect(finished.exitCode).toBe(EXIT_MISUSE);
  });

  test("exits clean when every workspace agrees with its list", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished).toStrictEqual({ exitCode: EXIT_SUCCESS, out: "", error: "" });
  });

  test("exits non-zero and prints each problem when a list is missing", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
      "specs/joining.spec.ts": 'describe("s", () => {\n  it("c", () => {});\n});\n',
    });
    const finished = await runVerifiedSpecifications([
      "check",
      "--repository-root",
      repositoryRoot,
    ]);
    expect(finished.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(finished.out).toContain("SPECIFICATIONS.md");
  });

  test("scans the working directory when no root is named", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": '{ "name": "standalone" }',
    });
    const launchDirectory = process.cwd();
    onTestFinished(() => {
      process.chdir(launchDirectory);
    });
    process.chdir(repositoryRoot);
    const finished = await runVerifiedSpecifications(["check"]);
    expect(finished.exitCode).toBe(EXIT_SUCCESS);
  });

  test("reports an option it does not know as misuse", async () => {
    const finished = await runVerifiedSpecifications(["check", "--unknown-option"]);
    expect(finished.exitCode).toBe(EXIT_MISUSE);
    expect(finished.error).toContain("--unknown-option");
  });
});
