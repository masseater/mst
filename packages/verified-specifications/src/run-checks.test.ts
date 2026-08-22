import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { runChecks } from "./run-checks.ts";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const PACKAGE_MANIFEST = '{ "name": "@mst/repository-checks" }';

const SPEC_SOURCE = `describe("行の結合", () => {
  it("各要素を畳む", () => {});
});
`;

const STALE_DOCUMENT =
  "A specification list must not fall behind the tests it is extracted from, because a reader would review claims the code no longer makes. Run `verified-specifications check --write` (wired as `vp run guard:fix`) to regenerate SPECIFICATIONS.md.";

const ORPHAN_DOCUMENT =
  "A specification list must not outlive the specification tests it was extracted from, because it would keep promising behavior nothing verifies. Run `verified-specifications check --write` to delete this SPECIFICATIONS.md, or restore the tests under specs/.";

const SUBJECT_WITHOUT_CLAIMS =
  "A subject must not stand without claims, because a heading with no sentences under it promises nothing. Give the describe at least one it, or delete it.";

const NARROWED_WITH_INCLUDE =
  "A tsconfig that governs specification tests must not narrow the files it checks with include, because a specs/ directory dropped from the program loses type checking silently while every check stays green. Delete include and let the tsconfig cover the whole workspace.";

describe("runChecks", () => {
  describe("a workspace whose list has never been written", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theMessagesOfAMissingList", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/specs/text-joining.spec.ts"),
          SPEC_SOURCE,
          "utf-8",
        );
        const problems = await runChecks({ repositoryRoot, write: false });
        return problems.map((problem) => problem.message);
      });

    it("reports the list as fallen behind the tests", ({ theMessagesOfAMissingList }) => {
      expect(theMessagesOfAMissingList).toStrictEqual([STALE_DOCUMENT]);
    });
  });

  describe("a writing run over a workspace whose list has never been written", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theProblemsOfAWritingRun", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/specs/text-joining.spec.ts"),
          SPEC_SOURCE,
          "utf-8",
        );
        return runChecks({ repositoryRoot, write: true });
      });

    it("finds nothing left to report", ({ theProblemsOfAWritingRun }) => {
      expect(theProblemsOfAWritingRun).toStrictEqual([]);
    });
  });

  describe("the list a writing run leaves behind", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theListWrittenByAWritingRun", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/specs/text-joining.spec.ts"),
          SPEC_SOURCE,
          "utf-8",
        );
        await runChecks({ repositoryRoot, write: true });
        return readFile(
          join(repositoryRoot, "packages/repository-checks/SPECIFICATIONS.md"),
          "utf-8",
        );
      });

    it("carries the subject the tests name", ({ theListWrittenByAWritingRun }) => {
      expect(theListWrittenByAWritingRun).toMatchInlineSnapshot(`
        "# @mst/repository-checks

        生成物。\`vp run guard:fix\` が \`specs/\` の仕様担保テストから再生成する。手で編集しない。

        ## 行の結合

        [\`specs/text-joining.spec.ts\`](specs/text-joining.spec.ts)

        - 各要素を畳む
        "
      `);
    });
  });

  describe("a reporting run over a list that matches the tests", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theProblemsOfAListThatMatchesTheTests", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/specs/text-joining.spec.ts"),
          SPEC_SOURCE,
          "utf-8",
        );
        await runChecks({ repositoryRoot, write: true });
        return runChecks({ repositoryRoot, write: false });
      });

    it("finds nothing to report", ({ theProblemsOfAListThatMatchesTheTests }) => {
      expect(theProblemsOfAListThatMatchesTheTests).toStrictEqual([]);
    });
  });

  describe("a workspace whose list disagrees with the tests", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theMessagesOfAStaleList", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/specs/text-joining.spec.ts"),
          SPEC_SOURCE,
          "utf-8",
        );
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/SPECIFICATIONS.md"),
          "# stale\n",
          "utf-8",
        );
        const problems = await runChecks({ repositoryRoot, write: false });
        return problems.map((problem) => problem.message);
      });

    it("reports the list as fallen behind the tests", ({ theMessagesOfAStaleList }) => {
      expect(theMessagesOfAStaleList).toStrictEqual([STALE_DOCUMENT]);
    });
  });

  describe("the stale list a reporting run leaves behind", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theStaleListAfterAReportingRun", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/specs/text-joining.spec.ts"),
          SPEC_SOURCE,
          "utf-8",
        );
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/SPECIFICATIONS.md"),
          "# stale\n",
          "utf-8",
        );
        await runChecks({ repositoryRoot, write: false });
        return readFile(
          join(repositoryRoot, "packages/repository-checks/SPECIFICATIONS.md"),
          "utf-8",
        );
      });

    it("still holds what it held before the run", ({ theStaleListAfterAReportingRun }) => {
      expect(theStaleListAfterAReportingRun).toBe("# stale\n");
    });
  });

  describe("a workspace whose list outlived its tests", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theMessagesOfAnOutlivedList", async ({ repositoryRoot }) => {
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/SPECIFICATIONS.md"),
          "# orphan\n",
          "utf-8",
        );
        const problems = await runChecks({ repositoryRoot, write: false });
        return problems.map((problem) => problem.message);
      });

    it("reports the list as promising what nothing verifies", ({ theMessagesOfAnOutlivedList }) => {
      expect(theMessagesOfAnOutlivedList).toStrictEqual([ORPHAN_DOCUMENT]);
    });
  });

  describe("a writing run over a list that outlived its tests", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theProblemsOfDeletingAnOutlivedList", async ({ repositoryRoot }) => {
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/SPECIFICATIONS.md"),
          "# orphan\n",
          "utf-8",
        );
        return runChecks({ repositoryRoot, write: true });
      });

    it("finds nothing left to report", ({ theProblemsOfDeletingAnOutlivedList }) => {
      expect(theProblemsOfDeletingAnOutlivedList).toStrictEqual([]);
    });
  });

  describe("the workspace a writing run left after deleting an outlived list", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theEntriesLeftAfterDeletingAnOutlivedList", async ({ repositoryRoot }) => {
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/SPECIFICATIONS.md"),
          "# orphan\n",
          "utf-8",
        );
        await runChecks({ repositoryRoot, write: true });
        return readdir(join(repositoryRoot, "packages/repository-checks"));
      });

    it("no longer holds the list", ({ theEntriesLeftAfterDeletingAnOutlivedList }) => {
      expect(theEntriesLeftAfterDeletingAnOutlivedList).toStrictEqual(["package.json"]);
    });
  });

  describe("a workspace with neither tests nor a list", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theProblemsOfAWorkspaceWithNeitherTestsNorList", async ({ repositoryRoot }) =>
        runChecks({ repositoryRoot, write: false }),
      );

    it("stays silent", ({ theProblemsOfAWorkspaceWithNeitherTestsNorList }) => {
      expect(theProblemsOfAWorkspaceWithNeitherTestsNorList).toStrictEqual([]);
    });
  });

  describe("a spec file whose subject stands without claims", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theMessagesOfASpecFileWithoutClaims", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/specs/text-joining.spec.ts"),
          "describe('s', () => {});\n",
          "utf-8",
        );
        const problems = await runChecks({ repositoryRoot, write: false });
        return problems.map((problem) => problem.message);
      });

    it("reports the structure of the spec file before the state of the list", ({
      theMessagesOfASpecFileWithoutClaims,
    }) => {
      expect(theMessagesOfASpecFileWithoutClaims).toStrictEqual([SUBJECT_WITHOUT_CLAIMS]);
    });
  });

  describe("a tsconfig that narrows the files it checks", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theMessagesOfATsconfigThatNarrowsTheProgram", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/specs/text-joining.spec.ts"),
          SPEC_SOURCE,
          "utf-8",
        );
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/tsconfig.json"),
          '{ "include": ["src"] }',
          "utf-8",
        );
        await runChecks({ repositoryRoot, write: true });
        const problems = await runChecks({ repositoryRoot, write: false });
        return problems.map((problem) => problem.message);
      });

    it("reports the narrowing alongside the spec problems", ({
      theMessagesOfATsconfigThatNarrowsTheProgram,
    }) => {
      expect(theMessagesOfATsconfigThatNarrowsTheProgram).toStrictEqual([NARROWED_WITH_INCLUDE]);
    });
  });

  describe("two workspaces reported in one run", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theFilesOfTheProblemsOfTwoWorkspaces", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/b-utils/specs"), { recursive: true });
        await mkdir(join(repositoryRoot, "packages/a-utils/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/b-utils/package.json"),
          '{ "name": "@mst/b-utils" }',
          "utf-8",
        );
        await writeFile(
          join(repositoryRoot, "packages/b-utils/specs/one.spec.ts"),
          SPEC_SOURCE,
          "utf-8",
        );
        await writeFile(
          join(repositoryRoot, "packages/a-utils/package.json"),
          '{ "name": "@mst/a-utils" }',
          "utf-8",
        );
        await writeFile(
          join(repositoryRoot, "packages/a-utils/specs/one.spec.ts"),
          SPEC_SOURCE,
          "utf-8",
        );
        const problems = await runChecks({ repositoryRoot, write: false });
        return problems
          .map((problem) => problem.file)
          .filter((file) => file !== "packages/repository-checks/SPECIFICATIONS.md");
      });

    it("keeps their problems sorted by file", ({ theFilesOfTheProblemsOfTwoWorkspaces }) => {
      expect(theFilesOfTheProblemsOfTwoWorkspaces).toStrictEqual([
        "packages/a-utils/SPECIFICATIONS.md",
        "packages/b-utils/SPECIFICATIONS.md",
      ]);
    });
  });

  describe("two problems in one file that name no line", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theLinesOfTwoProblemsWithoutALine", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/specs/text-joining.spec.ts"),
          SPEC_SOURCE,
          "utf-8",
        );
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/tsconfig.json"),
          '{ "include": ["src"], "files": ["src/index.ts"] }',
          "utf-8",
        );
        await runChecks({ repositoryRoot, write: true });
        const problems = await runChecks({ repositoryRoot, write: false });
        return problems.map((problem) => problem.line);
      });

    it("keeps both of them ahead of nothing in their file", ({
      theLinesOfTwoProblemsWithoutALine,
    }) => {
      expect(theLinesOfTwoProblemsWithoutALine).toStrictEqual([null, null]);
    });
  });

  describe("two problems in one file that name a line", () => {
    const it = test
      .extend("repositoryRoot", async ({}, { onCleanup }) => {
        const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
        onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
        await mkdir(join(temporaryRepositoryRoot, "packages/repository-checks"), {
          recursive: true,
        });
        await writeFile(
          join(temporaryRepositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_MANIFEST,
          "utf-8",
        );
        await writeFile(
          join(temporaryRepositoryRoot, "packages/repository-checks/package.json"),
          PACKAGE_MANIFEST,
          "utf-8",
        );
        return temporaryRepositoryRoot;
      })
      .extend("theLinesOfTwoProblemsInOneFile", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, "packages/repository-checks/specs"), { recursive: true });
        await writeFile(
          join(repositoryRoot, "packages/repository-checks/specs/text-joining.spec.ts"),
          "describe('s', () => {\n  test('a', () => {});\n  test('b', () => {});\n});\n",
          "utf-8",
        );
        const problems = await runChecks({ repositoryRoot, write: false });
        return problems.map((problem) => problem.line);
      });

    it("orders them by line", ({ theLinesOfTwoProblemsInOneFile }) => {
      expect(theLinesOfTwoProblemsInOneFile).toStrictEqual([2, 3]);
    });
  });
});
