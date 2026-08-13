import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND, EXIT_SUCCESS } from "@mst/repository-checks";
import { describe, expect, test } from "vite-plus/test";

import { runVerifiedSpecifications } from "./run-cli.ts";

const STANDALONE_MANIFEST = '{ "name": "standalone" }';

const SPEC_SOURCE = 'describe("s", () => {\n  it("c", () => {});\n});\n';

const USAGE = `Usage: verified-specifications <command> [options]

Commands:
  check   Extract the claims of every specification test and report each place where the structure cannot be read or a SPECIFICATIONS.md disagrees with them.

Options:
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
  --write                   Rewrite each SPECIFICATIONS.md instead of reporting it as stale.
`;

const UNKNOWN_OPTION_REFUSAL = `Unknown option '--unknown-option'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- "--unknown-option"\n`;

const MISSING_LIST_REPORT =
  "SPECIFICATIONS.md A specification list must not fall behind the tests it is extracted from, because a reader would review claims the code no longer makes. Run `verified-specifications check --write` (wired as `vp run guard:fix`) to regenerate SPECIFICATIONS.md.\n";

describe("runVerifiedSpecifications", () => {
  describe("a command it does not know", () => {
    const it = test.extend("theRunOfAnUnknownCommand", async () =>
      runVerifiedSpecifications(["deploy"]));

    it("refuses it as a misuse and spells the usage on the error stream", ({
      theRunOfAnUnknownCommand,
    }) => {
      expect(theRunOfAnUnknownCommand).toStrictEqual({
        exitCode: EXIT_MISUSE,
        out: "",
        error: USAGE,
      });
    });
  });

  describe("no command at all", () => {
    const it = test.extend("theRunWithoutACommand", async () => runVerifiedSpecifications([]));

    it("refuses it as a misuse and spells the usage on the error stream", ({
      theRunWithoutACommand,
    }) => {
      expect(theRunWithoutACommand).toStrictEqual({
        exitCode: EXIT_MISUSE,
        out: "",
        error: USAGE,
      });
    });
  });

  describe("an option it does not know", () => {
    const it = test.extend("theRunOfAnUnknownOption", async () =>
      runVerifiedSpecifications(["check", "--unknown-option"]));

    it("refuses it as a misuse and names the option it could not read", ({
      theRunOfAnUnknownOption,
    }) => {
      expect(theRunOfAnUnknownOption).toStrictEqual({
        exitCode: EXIT_MISUSE,
        out: "",
        error: UNKNOWN_OPTION_REFUSAL,
      });
    });
  });

  describe("a repository whose workspace agrees with its list", () => {
    const it = test.extend("theRunOfAnAgreeingRepository", async ({}, { onCleanup }) => {
      const repositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
      onCleanup(async () => rm(repositoryRoot, { recursive: true, force: true }));
      await writeFile(join(repositoryRoot, "package.json"), STANDALONE_MANIFEST, "utf-8");
      return runVerifiedSpecifications(["check", "--repository-root", repositoryRoot]);
    });

    it("exits clean and says nothing on either stream", ({ theRunOfAnAgreeingRepository }) => {
      expect(theRunOfAnAgreeingRepository).toStrictEqual({
        exitCode: EXIT_SUCCESS,
        out: "",
        error: "",
      });
    });
  });

  describe("a repository whose list is missing", () => {
    const it = test.extend("theRunOfARepositoryWithoutItsList", async ({}, { onCleanup }) => {
      const repositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
      onCleanup(async () => rm(repositoryRoot, { recursive: true, force: true }));
      await writeFile(join(repositoryRoot, "package.json"), STANDALONE_MANIFEST, "utf-8");
      await mkdir(join(repositoryRoot, "specs"), { recursive: true });
      await writeFile(join(repositoryRoot, "specs/joining.spec.ts"), SPEC_SOURCE, "utf-8");
      return runVerifiedSpecifications(["check", "--repository-root", repositoryRoot]);
    });

    it("exits non-zero and prints the problem it found", ({
      theRunOfARepositoryWithoutItsList,
    }) => {
      expect(theRunOfARepositoryWithoutItsList).toStrictEqual({
        exitCode: EXIT_PROBLEMS_FOUND,
        out: MISSING_LIST_REPORT,
        error: "",
      });
    });
  });

  describe("no repository root named", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const created = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(created, { recursive: true, force: true }));
        await writeFile(join(created, "package.json"), STANDALONE_MANIFEST, "utf-8");
        return created;
      })
      .extend("theRunFromTheWorkingDirectory", async ({ repositoryRoot }, { onCleanup }) => {
        const launchDirectory = process.cwd();
        onCleanup(() => {
          process.chdir(launchDirectory);
        });
        process.chdir(repositoryRoot);
        return runVerifiedSpecifications(["check"]);
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
