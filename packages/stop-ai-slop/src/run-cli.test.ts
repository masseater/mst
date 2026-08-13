import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { gitExecutablePath } from "@mst/repository-checks";
import { describe, expect, test, vi } from "vite-plus/test";

import { runStopAiSlop } from "./run-cli.ts";

const GIT_ENVIRONMENT = {
  GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
  GIT_AUTHOR_NAME: "Stop AI Slop",
  GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
  GIT_COMMITTER_NAME: "Stop AI Slop",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  PATH: process.env.PATH,
};

const USAGE_TEXT = `Usage: stop-ai-slop check [--base <revision> --head <revision>] [--repository-root <path>]

Commands:
  check   Run every registered check in definition order.

Options:
  --base <revision>         Git revision before the change. Requires --head.
  --head <revision>         Git revision after the change. Requires --base.
  --repository-root <path>  Root of the Git repository. Defaults to the current working directory.

Without --base and --head the change on its way into the integration branch is compared:
the staged merge result when a merge is in progress, and the history since it left
origin/main otherwise.
`;

const REMOVAL_PROBLEM_LINE =
  'src/legacy-api.test.ts:4 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n';

const REMOVAL_VERIFYING_SPEC =
  'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nexpect(legacy).not.toHaveProperty("legacyMode");\n';

describe("runStopAiSlop", () => {
  describe("an argument list naming no command at all", () => {
    const it = test.extend("commandlessRefusal", async () => runStopAiSlop([]));

    it("refuses the run and writes the usage text", ({ commandlessRefusal }) => {
      expect(commandlessRefusal).toStrictEqual({ exitCode: 2, out: "", error: USAGE_TEXT });
    });
  });

  describe("an argument list naming a command the runner does not carry", () => {
    const it = test.extend("unknownCommandRefusal", async () => runStopAiSlop(["scan"]));

    it("refuses the run and writes the usage text", ({ unknownCommandRefusal }) => {
      expect(unknownCommandRefusal).toStrictEqual({ exitCode: 2, out: "", error: USAGE_TEXT });
    });
  });

  describe("a check command carrying a positional beside its own name", () => {
    const it = test.extend("extraPositionalRefusal", async () => runStopAiSlop(["check", "extra"]));

    it("refuses the run and writes the usage text", ({ extraPositionalRefusal }) => {
      expect(extraPositionalRefusal).toStrictEqual({ exitCode: 2, out: "", error: USAGE_TEXT });
    });
  });

  describe("a check command carrying an option the runner does not declare", () => {
    const it = test.extend("unknownOptionRefusal", async () =>
      runStopAiSlop(["check", "--unknown"]));

    it("refuses the run and writes the usage text", ({ unknownOptionRefusal }) => {
      expect(unknownOptionRefusal).toStrictEqual({ exitCode: 2, out: "", error: USAGE_TEXT });
    });
  });

  describe("a check command whose base is empty", () => {
    const it = test.extend("emptyBaseRefusal", async () => runStopAiSlop(["check", "--base", ""]));

    it("refuses the run and writes the usage text", ({ emptyBaseRefusal }) => {
      expect(emptyBaseRefusal).toStrictEqual({ exitCode: 2, out: "", error: USAGE_TEXT });
    });
  });

  describe("a check command naming a base without naming a head", () => {
    const it = test.extend("headlessBaseRefusal", async () =>
      runStopAiSlop(["check", "--base", "base"]));

    it("refuses the run and writes the usage text", ({ headlessBaseRefusal }) => {
      expect(headlessBaseRefusal).toStrictEqual({ exitCode: 2, out: "", error: USAGE_TEXT });
    });
  });

  describe("a check command naming a base whose head is empty", () => {
    const it = test.extend("emptyHeadRefusal", async () =>
      runStopAiSlop(["check", "--base", "base", "--head", ""]));

    it("refuses the run and writes the usage text", ({ emptyHeadRefusal }) => {
      expect(emptyHeadRefusal).toStrictEqual({ exitCode: 2, out: "", error: USAGE_TEXT });
    });
  });

  describe("a head every registered check passes", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "stop-ai-slop-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: createdRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: createdRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(createdRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/current.ts", "export const current = true;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        writeSource("src/current.ts", "export const current = false;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return createdRoot;
      })
      .extend("passingCheck", async ({ repositoryRoot }) =>
        runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]),
      );

    it("stays silent and reports success", ({ passingCheck }) => {
      expect(passingCheck).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("a run naming no repository root", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "stop-ai-slop-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: createdRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: createdRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(createdRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/current.ts", "export const current = true;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        writeSource("src/current.ts", "export const current = false;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return createdRoot;
      })
      .extend("workingDirectoryCheck", async ({ repositoryRoot }) => {
        vi.spyOn(process, "cwd").mockReturnValue(repositoryRoot);
        return runStopAiSlop(["check", "--base", "HEAD~1", "--head", "HEAD"]);
      });

    it("reads the repository at the current working directory", ({ workingDirectoryCheck }) => {
      expect(workingDirectoryCheck).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("a feature branch that left the integration branch before a removal landed", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "stop-ai-slop-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: createdRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: createdRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(createdRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/legacy.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        runGit(["branch", "branch-point"]);
        writeSource("src/legacy.ts", "export const current = false;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        runGit(["checkout", "--quiet", "-b", "feature", "branch-point"]);
        writeSource("src/legacy.ts", "export const current = true;\n");
        writeSource("src/legacy-api.test.ts", REMOVAL_VERIFYING_SPEC);
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return createdRoot;
      })
      .extend("mergeBaseRevision", ({ repositoryRoot }) =>
        execFileSync("git", ["merge-base", "main", "feature"], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
        }),
      )
      .extend("branchPointRevision", ({ repositoryRoot }) =>
        execFileSync("git", ["rev-parse", "branch-point"], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
        }),
      )
      .extend("integrationTipCheck", async ({ repositoryRoot }) =>
        runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "main",
          "--head",
          "feature",
        ]),
      )
      .extend("branchPointCheck", async ({ repositoryRoot }) =>
        runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "branch-point",
          "--head",
          "feature",
        ]),
      );

    it("left the branch point standing as the merge base of the two branches", ({
      mergeBaseRevision,
      branchPointRevision,
    }) => {
      expect(mergeBaseRevision).toBe(branchPointRevision);
    });

    it("sees no removal when the base is the tip of the integration branch", ({
      integrationTipCheck,
    }) => {
      expect(integrationTipCheck).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });

    it("names the stale removal when the base is the merge base", ({ branchPointCheck }) => {
      expect(branchPointCheck).toStrictEqual({
        exitCode: 1,
        out: REMOVAL_PROBLEM_LINE,
        error: "",
      });
    });
  });

  describe("a head carrying a stale removal and no named revision", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "stop-ai-slop-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: createdRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: createdRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(createdRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/legacy.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        runGit(["update-ref", "refs/remotes/origin/main", "HEAD"]);
        writeSource("src/legacy.ts", "export const current = true;\n");
        writeSource("src/legacy-api.test.ts", REMOVAL_VERIFYING_SPEC);
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return createdRoot;
      })
      .extend("integrationBranchCheck", async ({ repositoryRoot }) =>
        runStopAiSlop(["check", "--repository-root", repositoryRoot]),
      );

    it("compares the history since the integration branch", ({ integrationBranchCheck }) => {
      expect(integrationBranchCheck).toStrictEqual({
        exitCode: 1,
        out: REMOVAL_PROBLEM_LINE,
        error: "",
      });
    });
  });

  describe("a base revision the repository does not carry", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "stop-ai-slop-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: createdRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: createdRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(createdRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/current.ts", "export const current = true;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return createdRoot;
      })
      .extend("missingBaseRefusal", async ({ repositoryRoot }) =>
        runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "missing-revision",
          "--head",
          "HEAD",
        ]),
      );

    it("fails closed and names the command that refused", ({ missingBaseRefusal }) => {
      expect(missingBaseRefusal).toStrictEqual({
        exitCode: 2,
        out: "",
        error: `Command failed: ${gitExecutablePath(process.env.PATH)} rev-parse --verify --end-of-options missing-revision^{tree}\nfatal: Needed a single revision\n\n`,
      });
    });
  });

  describe("a head carrying a relevant source the parser cannot read", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "stop-ai-slop-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: createdRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: createdRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(createdRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/legacy.ts", "export const legacyMode = true;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        writeSource("src/legacy.ts", "export const current = ;\n");
        runGit(["add", "--all"]);
        runGit(["commit", "--quiet", "--message", "snapshot"]);
        return createdRoot;
      })
      .extend("unreadableSourceRefusal", async ({ repositoryRoot }) =>
        runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]),
      );

    it("fails closed and names the source it could not read", ({ unreadableSourceRefusal }) => {
      expect(unreadableSourceRefusal).toStrictEqual({
        exitCode: 2,
        out: "",
        error: "src/legacy.ts: Unexpected token\n",
      });
    });
  });
});
