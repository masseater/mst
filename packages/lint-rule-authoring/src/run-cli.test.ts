import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { runLintRuleAuthoring } from "./run-cli.ts";

const USAGE = `Usage: lint-rule-authoring check [--write] [--repository-root <path>]

Reconciles every workspace lint rule index (docs/lint/index.md) with the rule
implementations found under the directories that the workspace manifests declare
in their lintRules field. Without --write it only reports the indexes that are
missing, unmarked, or stale; with --write it regenerates the generated region of
each index. Exits non-zero when a problem remains.

Options:
  --write                   Write the regenerated indexes instead of only reporting them.
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
`;

const MISSING_INDEX = `packages/example/docs/lint/index.md A workspace that declares lint rules must not go without \`packages/example/docs/lint/index.md\`. Generate it with \`vp run guard:fix\`.\n`;

const DECLARED_RULE = `export const rule = {
  name: "no-thing--allow-it",
  meta: { docs: { description: "Disallow the thing" }, messages: { report: "No." } },
  create: () => ({}),
};
`;

describe("runLintRuleAuthoring", () => {
  describe("a repository that declares no lint rules", () => {
    const testInAnEmptyRepository = test.extend("emptyRepository", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-authoring-cli-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return root;
    });

    describe("a check of it", () => {
      const it = testInAnEmptyRepository.extend("theRun", ({ emptyRepository }) =>
        runLintRuleAuthoring(["check", "--repository-root", emptyRepository]),
      );

      it("stays silent and exits zero because every index is fresh", ({ theRun }) => {
        expect(theRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
      });
    });

    describe("a check of a repository root inside it that is no directory", () => {
      const it = testInAnEmptyRepository.extend("theRun", ({ emptyRepository }) =>
        runLintRuleAuthoring(["check", "--repository-root", join(emptyRepository, "missing")]),
      );

      it("exits two instead of scanning nothing, naming the root back", ({
        theRun,
        emptyRepository,
      }) => {
        expect(theRun).toStrictEqual({
          exitCode: 2,
          out: "",
          error: `${resolve(join(emptyRepository, "missing"))} is not a directory that can be scanned.\n`,
        });
      });
    });
  });

  describe("a repository that declares lint rules and carries no index", () => {
    const testInADeclaringRepository = test.extend("declaringRepository", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-authoring-cli-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(
        join(root, "packages/example/package.json"),
        JSON.stringify({ lintRules: ["src/rules"] }),
        "utf8",
      );
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        DECLARED_RULE,
        "utf8",
      );
      return root;
    });

    describe("a check of it", () => {
      const it = testInADeclaringRepository.extend("theRun", ({ declaringRepository }) =>
        runLintRuleAuthoring(["check", "--repository-root", declaringRepository]),
      );

      it("reports the missing index and exits one", ({ theRun }) => {
        expect(theRun).toStrictEqual({ exitCode: 1, out: MISSING_INDEX, error: "" });
      });
    });

    describe("a check of it that is allowed to write", () => {
      const it = testInADeclaringRepository.extend("theRun", ({ declaringRepository }) =>
        runLintRuleAuthoring(["check", "--write", "--repository-root", declaringRepository]),
      );

      it("regenerates the indexes and exits zero", ({ theRun }) => {
        expect(theRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
      });
    });

    describe("a check of it that follows a writing check", () => {
      const it = testInADeclaringRepository.extend("theRun", ({ declaringRepository }) => {
        runLintRuleAuthoring(["check", "--write", "--repository-root", declaringRepository]);
        return runLintRuleAuthoring(["check", "--repository-root", declaringRepository]);
      });

      it("exits zero", ({ theRun }) => {
        expect(theRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
      });
    });
  });

  describe("a check given no repository root", () => {
    const it = test
      .extend("workingDirectory", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "lint-rule-authoring-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return root;
      })
      .extend("theRun", ({ workingDirectory }) => {
        vi.spyOn(process, "cwd").mockReturnValue(workingDirectory);
        return runLintRuleAuthoring(["check"]);
      });

    it("scans the working directory and finds nothing to report", ({ theRun }) => {
      expect(theRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("an unknown command", () => {
    const it = test.extend("theRun", () => runLintRuleAuthoring(["publish"]));

    it("returns the usage as an error and exits two", ({ theRun }) => {
      expect(theRun).toStrictEqual({ exitCode: 2, out: "", error: USAGE });
    });
  });

  describe("no command at all", () => {
    const it = test.extend("theRun", () => runLintRuleAuthoring([]));

    it("is answered the same way an unknown command is", ({ theRun }) => {
      expect(theRun).toStrictEqual({ exitCode: 2, out: "", error: USAGE });
    });
  });

  describe("an unknown option", () => {
    const it = test.extend("theRun", () => runLintRuleAuthoring(["check", "--repo-root", "."]));

    it("exits two instead of falling back to a default", ({ theRun }) => {
      expect(theRun).toStrictEqual({
        exitCode: 2,
        out: "",
        error: `Unknown option '--repo-root'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- "--repo-root"\n`,
      });
    });
  });
});
