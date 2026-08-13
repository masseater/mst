import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { parseRepositoryChanges } from "./repository-diff.ts";

const nulCharacter = String.fromCodePoint(0);

describe("parseRepositoryChanges", () => {
  const it = test
    .extend("theChangesOfAnEmptyComparison", () =>
      parseRepositoryChanges({ inventoryOutput: "", diff: "" }))
    .extend("theRefusalOfADiffThatProducesNoFiles", () => {
      try {
        parseRepositoryChanges({ inventoryOutput: "", diff: "not a git diff\n" });
      } catch (rejection) {
        return rejection;
      }
      throw new Error("parseRepositoryChanges accepted a diff that produces no files");
    })
    .extend("theRefusalOfInventoryTextWithoutNulDelimiters", () => {
      try {
        parseRepositoryChanges({ inventoryOutput: "invalid metadata", diff: "" });
      } catch (rejection) {
        return rejection;
      }
      throw new Error("parseRepositoryChanges accepted inventory text without NUL delimiters");
    })
    .extend("theRefusalOfInventoryWithAnEmptyPath", () => {
      try {
        parseRepositoryChanges({
          inventoryOutput: `A${nulCharacter}${nulCharacter}`,
          diff: "",
        });
      } catch (rejection) {
        return rejection;
      }
      throw new Error("parseRepositoryChanges accepted inventory with an empty path");
    })
    .extend("theRefusalOfARenameWithAnEmptySourcePath", () => {
      try {
        parseRepositoryChanges({
          inventoryOutput: `R100${nulCharacter}${nulCharacter}src/current.ts${nulCharacter}`,
          diff: "",
        });
      } catch (rejection) {
        return rejection;
      }
      throw new Error("parseRepositoryChanges accepted a rename with an empty source path");
    })
    .extend("theRefusalOfAnUnknownInventoryStatus", () => {
      try {
        parseRepositoryChanges({
          inventoryOutput: `X${nulCharacter}src/current.ts${nulCharacter}`,
          diff: "",
        });
      } catch (rejection) {
        return rejection;
      }
      throw new Error("parseRepositoryChanges accepted an unknown inventory status");
    })
    .extend("theRefusalOfAnInventoryFileMissingFromThePatch", () => {
      try {
        parseRepositoryChanges({
          inventoryOutput: `A${nulCharacter}src/added.ts${nulCharacter}`,
          diff: "",
        });
      } catch (rejection) {
        return rejection;
      }
      throw new Error("parseRepositoryChanges accepted an inventory file missing from the patch");
    })
    .extend("theRefusalOfAPatchWhoseFileTypeDisagreesWithTheInventory", () => {
      try {
        parseRepositoryChanges({
          inventoryOutput: `D${nulCharacter}src/current.ts${nulCharacter}`,
          diff: `diff --git src/current.ts src/current.ts
new file mode 100644
index 0000000..6cd59c7
--- /dev/null
+++ src/current.ts
@@ -0,0 +1 @@
+export const current = true;
`,
        });
      } catch (rejection) {
        return rejection;
      }
      throw new Error("parseRepositoryChanges accepted a patch disagreeing with the inventory");
    })
    .extend("theChangesOfARealGitTypeChange", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "stop-ai-slop-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const runGit = (handedArguments: readonly string[]): string =>
        execFileSync("git", [...handedArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
            GIT_AUTHOR_NAME: "Stop AI Slop",
            GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
            GIT_COMMITTER_NAME: "Stop AI Slop",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(resolve(repositoryRoot, "src"), { recursive: true });
      writeFileSync(resolve(repositoryRoot, "src/current.ts"), "export const current = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      unlinkSync(resolve(repositoryRoot, "src/current.ts"));
      symlinkSync("target.ts", resolve(repositoryRoot, "src/current.ts"));
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      const sharedArguments = [
        "-c",
        "core.quotePath=false",
        "-c",
        "diff.renameLimit=0",
        "diff",
        "--default-prefix",
        "--find-renames",
        "--no-ext-diff",
        "--no-textconv",
        "--no-color",
      ];
      return parseRepositoryChanges({
        inventoryOutput: runGit([
          ...sharedArguments,
          "--name-status",
          "-z",
          "HEAD~1",
          "HEAD",
          "--",
        ]),
        diff: runGit([...sharedArguments, "--unified=0", "HEAD~1", "HEAD", "--"]),
      });
    })
    .extend("theRefusalOfARealGitTypeChangeWithItsPatchFilesReversed", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "stop-ai-slop-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const runGit = (handedArguments: readonly string[]): string =>
        execFileSync("git", [...handedArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
            GIT_AUTHOR_NAME: "Stop AI Slop",
            GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
            GIT_COMMITTER_NAME: "Stop AI Slop",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(resolve(repositoryRoot, "src"), { recursive: true });
      writeFileSync(resolve(repositoryRoot, "src/current.ts"), "export const current = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      unlinkSync(resolve(repositoryRoot, "src/current.ts"));
      symlinkSync("target.ts", resolve(repositoryRoot, "src/current.ts"));
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      const sharedArguments = [
        "-c",
        "core.quotePath=false",
        "-c",
        "diff.renameLimit=0",
        "diff",
        "--default-prefix",
        "--find-renames",
        "--no-ext-diff",
        "--no-textconv",
        "--no-color",
      ];
      const inventoryOutput = runGit([
        ...sharedArguments,
        "--name-status",
        "-z",
        "HEAD~1",
        "HEAD",
        "--",
      ]);
      const patchFiles = runGit([...sharedArguments, "--unified=0", "HEAD~1", "HEAD", "--"]).split(
        /(?=diff --git )/u,
      );
      try {
        parseRepositoryChanges({ inventoryOutput, diff: patchFiles.toReversed().join("") });
      } catch (rejection) {
        return rejection;
      }
      throw new Error("parseRepositoryChanges accepted a type change with reversed patch files");
    });

  it("hands back no changes for empty metadata and patch", ({ theChangesOfAnEmptyComparison }) => {
    expect(theChangesOfAnEmptyComparison).toStrictEqual([]);
  });

  it("refuses a non-empty diff that produces no files", ({
    theRefusalOfADiffThatProducesNoFiles,
  }) => {
    expect(theRefusalOfADiffThatProducesNoFiles).toStrictEqual(
      new Error("Unable to parse non-empty Git diff"),
    );
  });

  it("refuses inventory text that carries no NUL delimiters", ({
    theRefusalOfInventoryTextWithoutNulDelimiters,
  }) => {
    expect(theRefusalOfInventoryTextWithoutNulDelimiters).toStrictEqual(
      new Error("Invalid NUL-delimited Git diff metadata"),
    );
  });

  it("refuses an inventory record whose path is empty", ({
    theRefusalOfInventoryWithAnEmptyPath,
  }) => {
    expect(theRefusalOfInventoryWithAnEmptyPath).toStrictEqual(
      new Error("Invalid NUL-delimited Git diff metadata"),
    );
  });

  it("refuses a rename record whose source path is empty", ({
    theRefusalOfARenameWithAnEmptySourcePath,
  }) => {
    expect(theRefusalOfARenameWithAnEmptySourcePath).toStrictEqual(
      new Error("Invalid NUL-delimited Git diff metadata"),
    );
  });

  it("refuses an inventory status the parser does not know", ({
    theRefusalOfAnUnknownInventoryStatus,
  }) => {
    expect(theRefusalOfAnUnknownInventoryStatus).toStrictEqual(
      new Error("Unsupported Git diff status"),
    );
  });

  it("refuses an inventory file the patch omits", ({
    theRefusalOfAnInventoryFileMissingFromThePatch,
  }) => {
    expect(theRefusalOfAnInventoryFileMissingFromThePatch).toStrictEqual(
      new Error("Git diff metadata and patch file counts disagree: 1 != 0"),
    );
  });

  it("refuses a patch whose file type disagrees with the inventory", ({
    theRefusalOfAPatchWhoseFileTypeDisagreesWithTheInventory,
  }) => {
    expect(theRefusalOfAPatchWhoseFileTypeDisagreesWithTheInventory).toStrictEqual(
      new Error("Git diff metadata and patch disagree: DeletedFile != AddedFile"),
    );
  });

  it("reconciles a real Git type change as deleted then added", ({
    theChangesOfARealGitTypeChange,
  }) => {
    expect(theChangesOfARealGitTypeChange).toStrictEqual([
      {
        kind: "changed",
        beforePath: "src/current.ts",
        afterPath: "src/current.ts",
        addedLines: [1],
      },
    ]);
  });

  it("refuses a real Git type change whose patch files arrive reversed", ({
    theRefusalOfARealGitTypeChangeWithItsPatchFilesReversed,
  }) => {
    expect(theRefusalOfARealGitTypeChangeWithItsPatchFilesReversed).toStrictEqual(
      new Error("Git diff metadata and patch disagree: DeletedFile != AddedFile"),
    );
  });
});
