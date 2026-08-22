import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { tsconfigScopeProblemsOf } from "./tsconfig-scope.ts";

const WORKSPACE_DIRECTORY = "packages/repository-checks";

const NARROWED_WITH_INCLUDE =
  "A tsconfig that governs specification tests must not narrow the files it checks with include, because a specs/ directory dropped from the program loses type checking silently while every check stays green. Delete include and let the tsconfig cover the whole workspace.";

const NARROWED_WITH_FILES =
  "A tsconfig that governs specification tests must not narrow the files it checks with files, because a specs/ directory dropped from the program loses type checking silently while every check stays green. Delete files and let the tsconfig cover the whole workspace.";

const NARROWED_WITH_EXCLUDE =
  "A tsconfig that governs specification tests must not narrow the files it checks with exclude, because a specs/ directory dropped from the program loses type checking silently while every check stays green. Delete exclude and let the tsconfig cover the whole workspace.";

describe("tsconfigScopeProblemsOf", () => {
  const repositoryTest = test.extend("repositoryRoot", async ({}, { onCleanup }) => {
    const temporaryRepositoryRoot = await mkdtemp(join(tmpdir(), "verified-specifications-"));
    onCleanup(async () => rm(temporaryRepositoryRoot, { recursive: true, force: true }));
    return temporaryRepositoryRoot;
  });

  describe("a workspace tsconfig that only extends a preset", () => {
    const it = repositoryTest.extend(
      "theMessagesOfATsconfigThatOnlyExtendsAPreset",
      async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, WORKSPACE_DIRECTORY), { recursive: true });
        await writeFile(
          join(repositoryRoot, WORKSPACE_DIRECTORY, "tsconfig.json"),
          '{ "extends": "preset" }',
          "utf-8",
        );
        const problems = await tsconfigScopeProblemsOf({
          repositoryRoot,
          workspaceDirectory: join(repositoryRoot, WORKSPACE_DIRECTORY),
        });
        return problems.map((problem) => problem.message);
      },
    );

    it("is accepted without a problem", ({ theMessagesOfATsconfigThatOnlyExtendsAPreset }) => {
      expect(theMessagesOfATsconfigThatOnlyExtendsAPreset).toStrictEqual([]);
    });
  });

  describe("a workspace tsconfig that narrows with include", () => {
    const it = repositoryTest
      .extend("theMessagesOfATsconfigNarrowingWithInclude", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, WORKSPACE_DIRECTORY), { recursive: true });
        await writeFile(
          join(repositoryRoot, WORKSPACE_DIRECTORY, "tsconfig.json"),
          '{ "include": ["src"] }',
          "utf-8",
        );
        const problems = await tsconfigScopeProblemsOf({
          repositoryRoot,
          workspaceDirectory: join(repositoryRoot, WORKSPACE_DIRECTORY),
        });
        return problems.map((problem) => problem.message);
      })
      .extend("theFilesOfATsconfigNarrowingWithInclude", async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, WORKSPACE_DIRECTORY), { recursive: true });
        await writeFile(
          join(repositoryRoot, WORKSPACE_DIRECTORY, "tsconfig.json"),
          '{ "include": ["src"] }',
          "utf-8",
        );
        const problems = await tsconfigScopeProblemsOf({
          repositoryRoot,
          workspaceDirectory: join(repositoryRoot, WORKSPACE_DIRECTORY),
        });
        return problems.map((problem) => problem.file);
      });

    it("is reported as narrowing with include", ({
      theMessagesOfATsconfigNarrowingWithInclude,
    }) => {
      expect(theMessagesOfATsconfigNarrowingWithInclude).toStrictEqual([NARROWED_WITH_INCLUDE]);
    });

    it("is named by its path relative to the repository root", ({
      theFilesOfATsconfigNarrowingWithInclude,
    }) => {
      expect(theFilesOfATsconfigNarrowingWithInclude).toStrictEqual([
        "packages/repository-checks/tsconfig.json",
      ]);
    });
  });

  describe("a workspace tsconfig that narrows with files", () => {
    const it = repositoryTest.extend(
      "theMessagesOfATsconfigNarrowingWithFiles",
      async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, WORKSPACE_DIRECTORY), { recursive: true });
        await writeFile(
          join(repositoryRoot, WORKSPACE_DIRECTORY, "tsconfig.json"),
          '{ "files": ["src/index.ts"] }',
          "utf-8",
        );
        const problems = await tsconfigScopeProblemsOf({
          repositoryRoot,
          workspaceDirectory: join(repositoryRoot, WORKSPACE_DIRECTORY),
        });
        return problems.map((problem) => problem.message);
      },
    );

    it("is reported as narrowing with files", ({ theMessagesOfATsconfigNarrowingWithFiles }) => {
      expect(theMessagesOfATsconfigNarrowingWithFiles).toStrictEqual([NARROWED_WITH_FILES]);
    });
  });

  describe("a workspace tsconfig that narrows with exclude", () => {
    const it = repositoryTest.extend(
      "theMessagesOfATsconfigNarrowingWithExclude",
      async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, WORKSPACE_DIRECTORY), { recursive: true });
        await writeFile(
          join(repositoryRoot, WORKSPACE_DIRECTORY, "tsconfig.json"),
          '{ "exclude": ["specs"] }',
          "utf-8",
        );
        const problems = await tsconfigScopeProblemsOf({
          repositoryRoot,
          workspaceDirectory: join(repositoryRoot, WORKSPACE_DIRECTORY),
        });
        return problems.map((problem) => problem.message);
      },
    );

    it("is reported as narrowing with exclude", ({
      theMessagesOfATsconfigNarrowingWithExclude,
    }) => {
      expect(theMessagesOfATsconfigNarrowingWithExclude).toStrictEqual([NARROWED_WITH_EXCLUDE]);
    });
  });

  describe("a workspace tsconfig that carries a comment beside its include", () => {
    const it = repositoryTest.extend(
      "theMessagesOfATsconfigCarryingAComment",
      async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, WORKSPACE_DIRECTORY), { recursive: true });
        await writeFile(
          join(repositoryRoot, WORKSPACE_DIRECTORY, "tsconfig.json"),
          '{\n  // note\n  "include": ["src"]\n}',
          "utf-8",
        );
        const problems = await tsconfigScopeProblemsOf({
          repositoryRoot,
          workspaceDirectory: join(repositoryRoot, WORKSPACE_DIRECTORY),
        });
        return problems.map((problem) => problem.message);
      },
    );

    it("is read past the comment and reported as narrowing with include", ({
      theMessagesOfATsconfigCarryingAComment,
    }) => {
      expect(theMessagesOfATsconfigCarryingAComment).toStrictEqual([NARROWED_WITH_INCLUDE]);
    });
  });

  describe("a repository tsconfig standing in for a workspace that has none", () => {
    const it = repositoryTest.extend(
      "theMessagesOfARepositoryTsconfigGoverningTheWorkspace",
      async ({ repositoryRoot }) => {
        await writeFile(join(repositoryRoot, "tsconfig.json"), '{ "include": ["src"] }', "utf-8");
        const problems = await tsconfigScopeProblemsOf({
          repositoryRoot,
          workspaceDirectory: join(repositoryRoot, WORKSPACE_DIRECTORY),
        });
        return problems.map((problem) => problem.message);
      },
    );

    it("governs the workspace and is reported for narrowing with include", ({
      theMessagesOfARepositoryTsconfigGoverningTheWorkspace,
    }) => {
      expect(theMessagesOfARepositoryTsconfigGoverningTheWorkspace).toStrictEqual([
        NARROWED_WITH_INCLUDE,
      ]);
    });
  });

  describe("a workspace governed by no tsconfig at all", () => {
    const it = repositoryTest.extend(
      "theMessagesWhenNoTsconfigGovernsTheWorkspace",
      async ({ repositoryRoot }) => {
        const problems = await tsconfigScopeProblemsOf({
          repositoryRoot,
          workspaceDirectory: join(repositoryRoot, WORKSPACE_DIRECTORY),
        });
        return problems.map((problem) => problem.message);
      },
    );

    it("leaves the scan silent", ({ theMessagesWhenNoTsconfigGovernsTheWorkspace }) => {
      expect(theMessagesWhenNoTsconfigGovernsTheWorkspace).toStrictEqual([]);
    });
  });

  describe("a workspace tsconfig that parses into something other than a mapping", () => {
    const it = repositoryTest.extend(
      "theMessagesOfATsconfigThatIsNotAMapping",
      async ({ repositoryRoot }) => {
        await mkdir(join(repositoryRoot, WORKSPACE_DIRECTORY), { recursive: true });
        await writeFile(
          join(repositoryRoot, WORKSPACE_DIRECTORY, "tsconfig.json"),
          '["not a mapping"]',
          "utf-8",
        );
        const problems = await tsconfigScopeProblemsOf({
          repositoryRoot,
          workspaceDirectory: join(repositoryRoot, WORKSPACE_DIRECTORY),
        });
        return problems.map((problem) => problem.message);
      },
    );

    it("leaves the scan silent", ({ theMessagesOfATsconfigThatIsNotAMapping }) => {
      expect(theMessagesOfATsconfigThatIsNotAMapping).toStrictEqual([]);
    });
  });
});
